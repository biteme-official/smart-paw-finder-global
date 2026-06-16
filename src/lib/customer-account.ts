// Shopify Customer Account API GraphQL client
import { getAccessToken, refreshAccessToken } from './customer-auth';

const ACCOUNT_PROXY = '/api/customer-account';

async function customerAccountRequest<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshAccessToken();
    if (!token) return null;
  }

  const response = await fetch(ACCOUNT_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return null;
    return customerAccountRequest(query, variables);
  }

  if (!response.ok) {
    throw new Error(`Customer Account API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors.map((e: any) => e.message).join(', '));
  }
  return data.data;
}

export interface CustomerAccountProfile {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  defaultAddress: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  orders: CustomerAccountOrder[];
}

export interface CustomerAccountOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  statusPageUrl: string | null;
  totalPrice: { amount: string; currencyCode: string };
  shippingAddress: { city?: string | null; province?: string | null; country?: string | null } | null;
  fulfillments: Array<{ trackingCompany: string | null; trackingNumber: string | null; trackingUrl: string | null }>;
  lineItems: Array<{
    title: string;
    quantity: number;
    image: { url: string } | null;
  }>;
}

const GET_CUSTOMER_QUERY = `
  query GetCustomer {
    customer {
      id
      displayName
      firstName
      lastName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      defaultAddress {
        address1 address2 city province zip
        territoryCode
      }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            statusPageUrl
            totalPrice { amount currencyCode }
            shippingAddress { city province territoryCode }
            fulfillments(first: 5) {
              edges {
                node {
                  trackingInformation { company number url }
                }
              }
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  image { url }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchCustomerAccount(): Promise<CustomerAccountProfile | null> {
  const data = await customerAccountRequest<any>(GET_CUSTOMER_QUERY);
  if (!data?.customer) return null;

  const c = data.customer;
  return {
    id: c.id,
    displayName: c.displayName,
    firstName: c.firstName,
    lastName: c.lastName,
    emailAddress: c.emailAddress?.emailAddress || null,
    phoneNumber: c.phoneNumber?.phoneNumber || null,
    defaultAddress: c.defaultAddress ? {
      address1: c.defaultAddress.address1,
      address2: c.defaultAddress.address2,
      city: c.defaultAddress.city,
      province: c.defaultAddress.province,
      zip: c.defaultAddress.zip,
      country: c.defaultAddress.territoryCode,
    } : null,
    orders: (c.orders?.edges || []).map((edge: any) => {
      const node = edge.node;
      const fulfillments = (node.fulfillments?.edges || []).map((fe: any) => {
        const info = fe.node.trackingInformation?.[0] || {};
        return {
          trackingCompany: info.company || null,
          trackingNumber: info.number || null,
          trackingUrl: info.url || null,
        };
      });
      return {
        id: node.id,
        name: node.name,
        processedAt: node.processedAt,
        financialStatus: node.financialStatus,
        fulfillmentStatus: node.fulfillmentStatus,
        statusPageUrl: node.statusPageUrl,
        totalPrice: node.totalPrice,
        shippingAddress: node.shippingAddress ? {
          city: node.shippingAddress.city,
          province: node.shippingAddress.province,
          country: node.shippingAddress.territoryCode,
        } : null,
        fulfillments,
        lineItems: (node.lineItems?.edges || []).map((li: any) => ({
          title: li.node.title,
          quantity: li.node.quantity,
          image: li.node.image,
        })),
      };
    }),
  };
}

const STOREFRONT_TOKEN_MUTATION = `
  mutation {
    storefrontCustomerAccessTokenCreate {
      accessToken
      expiresAt
    }
  }
`;

export async function createStorefrontCustomerToken(): Promise<string | null> {
  const data = await customerAccountRequest<any>(STOREFRONT_TOKEN_MUTATION);
  return data?.storefrontCustomerAccessTokenCreate?.accessToken || null;
}

export async function cancelCustomerOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, error: 'Not logged in' };

  const response = await fetch('/api/cancel-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, customerAccountToken: token }),
  });
  return response.json();
}
