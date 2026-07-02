import { toast } from "sonner";
import { useAuthStore } from '@/stores/authStore';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { getCachedStorefrontCustomerToken, fetchCustomerAccount } from '@/lib/customer-account';

// Shopify API - requests go through the server proxy which handles authentication
const SHOPIFY_PROXY_URL = '/api/shopify';
const SHOPIFY_ADMIN_PROXY_URL = '/api/shopify?api=admin';

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    descriptionHtml: string;
    handle: string;
    availableForSale?: boolean;
    totalInventory?: number | null;
    productType: string;
    tags: string[];
    vendor: string;
    priceRange: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    };
    images: {
      edges: Array<{
        node: {
          url: string;
          altText: string | null;
        };
      }>;
    };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: {
            amount: string;
            currencyCode: string;
          };
          availableForSale: boolean;
          quantityAvailable: number | null;
          image?: {
            url: string;
            altText: string | null;
          } | null;
          selectedOptions: Array<{
            name: string;
            value: string;
          }>;
        };
      }>;
    };
    options: Array<{
      name: string;
      values: string[];
    }>;
  };
}

// Storefront API helper function - proxied through server for secure token management
export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (response.status === 402) {
    toast.error("Shopify: Payment required", {
      description: "Shopify API access requires an active Shopify billing plan. Visit https://admin.shopify.com to upgrade.",
    });
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Error calling Shopify: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  return data;
}

async function adminApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_ADMIN_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Admin API HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Admin API error: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }
  return data;
}

// GraphQL Queries
const GET_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          handle
          availableForSale
          productType
          tags
          vendor
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                availableForSale
                image {
                  url
                  altText
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    }
  }
`;

const GET_PRODUCTS_COUNT_QUERY = `
  query GetProductsCount($query: String, $after: String) {
    products(first: 250, query: $query, after: $after) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_COLLECTION_COUNT_QUERY = `
  query GetCollectionCount($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 250, after: $after) {
        edges { node { id } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const GET_PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      descriptionHtml
      handle
      availableForSale
      productType
      tags
      vendor
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 20) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            availableForSale
            image {
              url
              altText
            }
            selectedOptions {
              name
              value
            }
          }
        }
      }
      options {
        name
        values
      }
    }
  }
`;

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Collections
export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
}

const GET_COLLECTIONS_QUERY = `
  query GetCollections($first: Int!) {
    collections(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          description
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

// Navigation Menu (supports nested category depth from Shopify theme)
export interface ShopifyMenuItem {
  id: string;
  title: string;
  url: string;
  type: string;
  resourceId: string | null;
  items: ShopifyMenuItem[];
}

export interface ShopifyMenu {
  id: string;
  handle: string;
  title: string;
  items: ShopifyMenuItem[];
}

const GET_MENU_QUERY = `
  query GetMenu($handle: String!) {
    menu(handle: $handle) {
      id
      handle
      title
      items {
        id
        title
        url
        type
        resourceId
        items {
          id
          title
          url
          type
          resourceId
          items {
            id
            title
            url
            type
            resourceId
            items {
              id
              title
              url
              type
              resourceId
            }
          }
        }
      }
    }
  }
`;

const GET_COLLECTION_PRODUCTS_QUERY = `
  query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      handle
      products(first: $first, after: $after, sortKey: CREATED, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            description
            handle
            availableForSale
            productType
            tags
            vendor
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                  image {
                    url
                    altText
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            options {
              name
              values
            }
          }
        }
      }
    }
  }
`;

// Fetch only product IDs from a collection (lightweight, for intersection)
const GET_COLLECTION_IDS_QUERY = `
  query GetCollectionIds($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id } }
      }
    }
  }
`;

async function fetchCollectionProductIds(handle: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let after: string | undefined;
  while (true) {
    const data = await storefrontApiRequest(GET_COLLECTION_IDS_QUERY, { handle, after });
    const products = data?.data?.collection?.products;
    if (!products) break;
    for (const { node } of products.edges) ids.add(node.id);
    if (!products.pageInfo.hasNextPage) break;
    after = products.pageInfo.endCursor;
  }
  return ids;
}

// Return products that belong to ALL given collections (handles ordered 大分→小分)
// e.g. ["ssfw", "toy"] → products in both the ssfw collection AND the toy collection
export async function fetchCollectionIntersection(
  handles: string[],
  first: number = 20,
): Promise<ProductsResponse> {
  if (handles.length === 0) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  if (handles.length === 1) {
    const r = await fetchCollectionProducts(handles[0], first);
    return { products: r.products, pageInfo: r.pageInfo };
  }

  const parentHandles = handles.slice(0, -1);
  const childHandle = handles[handles.length - 1];

  // Fetch parent collection IDs and child products in parallel
  const [parentIdSets, childResponse] = await Promise.all([
    Promise.all(parentHandles.map(fetchCollectionProductIds)),
    fetchCollectionProducts(childHandle, 250),
  ]);

  // Keep only products present in every parent collection
  const filtered = childResponse.products.filter(p =>
    parentIdSets.every(set => set.has(p.node.id))
  );

  return {
    products: filtered,
    pageInfo: { hasNextPage: false, endCursor: null },
  };
}

export async function fetchCollectionIntersectionCount(handles: string[]): Promise<number> {
  if (handles.length === 0) return 0;
  if (handles.length === 1) {
    return fetchCollectionProductCount(handles[0]);
  }
  const allSets = await Promise.all(handles.map(fetchCollectionProductIds));
  const base = allSets[0];
  const rest = allSets.slice(1);
  let count = 0;
  for (const id of base) {
    if (rest.every(set => set.has(id))) count++;
  }
  return count;
}

// Curated Reels (Metaobjects)
export interface ShopifyCuratedReel {
  id: string;
  shortcode: string;   // optional — only needed if Instagram embed is used
  thumbnailUrl: string | null;
  videoUrl: string | null;
  productHandle: string;
  sortOrder: number;
}

const GET_CURATED_REELS_QUERY = `
  query GetCuratedReels($first: Int!) {
    metaobjects(type: "curated_reel", first: $first) {
      edges {
        node {
          id
          fields {
            key
            value
          }
        }
      }
    }
  }
`;

function extractReelShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

export async function fetchCuratedReels(first: number = 20): Promise<ShopifyCuratedReel[]> {
  const data = await adminApiRequest(GET_CURATED_REELS_QUERY, { first });
  if (!data) return [];

  const reels: ShopifyCuratedReel[] = (data.data?.metaobjects?.edges || []).map((edge: { node: { id: string; fields: { key: string; value: string }[] } }) => {
    const fields: Record<string, string> = {};
    for (const f of edge.node.fields) {
      if (f.value) fields[f.key] = f.value;
    }
    // shortcode: 직접 입력 값 우선, 없으면 reel_url에서 Instagram shortcode 추출
    const shortcode = fields.shortcode?.trim()
      || (fields.reel_url ? extractReelShortcode(fields.reel_url) : null)
      || '';

    // reel_url이 재생 불가능한 URL이면 null 처리
    const rawReelUrl = fields.reel_url?.trim() || '';
    const isInstagramUrl = rawReelUrl.includes('instagram.com');
    const isImageUrl = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(rawReelUrl);
    const videoUrl = rawReelUrl && !isInstagramUrl && !isImageUrl ? rawReelUrl : null;

    if (rawReelUrl && (isInstagramUrl || isImageUrl)) {
      console.warn(
        `[curated_reel] product_handle="${fields.product_handle}" 의 reel_url이 재생 불가능한 URL입니다.\n` +
        `→ 이미지/Instagram URL이 아닌 MP4 파일 URL을 입력해야 영상이 재생됩니다.\n` +
        `→ 현재 값: ${rawReelUrl}`
      );
    } else if (!rawReelUrl) {
      console.warn(
        `[curated_reel] product_handle="${fields.product_handle}" 의 reel_url이 비어 있습니다.\n` +
        `→ Shopify Admin에서 reel_url에 MP4 파일 URL을 입력해야 영상이 재생됩니다.`
      );
    }

    return {
      id: edge.node.id,
      shortcode,
      thumbnailUrl: fields.thumbnail_url || null,
      videoUrl,
      productHandle: fields.product_handle?.trim() || '',
      sortOrder: Number(fields.sort_order) || 0,
    };
  });

  return reels
    // productHandle만 필수 — shortcode는 video 재생에 불필요
    .filter(r => r.productHandle.trim())
    // sort_order 미입력(0) 항목은 맨 뒤로
    .sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
}

// Banners (Metaobjects)
export interface ShopifyBanner {
  id: string;
  handle: string;
  image: { url: string; altText: string | null } | null;
  linkUrl: string | null;
  fields: Record<string, string>;
}

const GET_BANNERS_QUERY = `
  query GetBanners($first: Int!) {
    metaobjects(type: "main_banner", first: $first) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
            type
            reference {
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;


export async function fetchBanners(first: number = 10): Promise<ShopifyBanner[]> {
  const data = await adminApiRequest(GET_BANNERS_QUERY, { first });
  if (!data) return [];

  const banners = (data.data?.metaobjects?.edges || []).map((edge: any) => {
    const node = edge.node;
    const fields: Record<string, string> = {};
    let image: { url: string; altText: string | null } | null = null;

    let linkUrl: string | null = null;

    for (const field of node.fields) {
      if (field.reference?.image) {
        image = field.reference.image;
      }
      if (field.type === 'link' && field.value) {
        try {
          const parsed = JSON.parse(field.value);
          linkUrl = parsed.url || null;
        } catch {
          linkUrl = null;
        }
      } else if (field.value) {
        fields[field.key] = field.value;
      }
    }

    return { id: node.id, handle: node.handle, image, linkUrl, fields };
  });

  banners.sort((a, b) => {
    const aOrder = a.fields.sort_order;
    const bOrder = b.fields.sort_order;
    if (aOrder == null || aOrder === '') return 1;
    if (bOrder == null || bOrder === '') return -1;
    return Number(aOrder) - Number(bOrder);
  });

  return banners;
}

// Announcement Bar (Metaobjects)
export interface AnnouncementItem {
  id: string;
  message: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const GET_ANNOUNCEMENTS_QUERY = `
  query GetAnnouncements($first: Int!) {
    metaobjects(type: "announcement_bar", first: $first) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
            type
          }
        }
      }
    }
  }
`;

export async function fetchAnnouncements(first: number = 10): Promise<AnnouncementItem[]> {
  const data = await adminApiRequest(GET_ANNOUNCEMENTS_QUERY, { first });
  if (!data) return [];

  const items = (data.data?.metaobjects?.edges || []).map((edge: any) => {
    const node = edge.node;
    const fields: Record<string, string> = {};
    let linkUrl: string | null = null;

    for (const field of node.fields) {
      if (field.type === 'link' && field.value) {
        try {
          const parsed = JSON.parse(field.value);
          linkUrl = parsed.url || null;
        } catch {
          linkUrl = null;
        }
      } else if (field.value) {
        fields[field.key] = field.value;
      }
    }

    return {
      id: node.id,
      message: fields.message || '',
      linkUrl,
      sortOrder: Number(fields.sort_order) || 0,
      isActive: fields.is_active === 'true',
    };
  });

  return items
    .filter((item: AnnouncementItem) => item.isActive && item.message)
    .sort((a: AnnouncementItem, b: AnnouncementItem) => a.sortOrder - b.sortOrder);
}

export interface ProductsResponse {
  products: ShopifyProduct[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

const GET_BEST_SELLING_PRODUCTS_QUERY = `
  query GetBestSellingProducts($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          handle
          availableForSale
          productType
          tags
          vendor
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          images(first: 5) {
            edges { node { url altText } }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                availableForSale
                image { url altText }
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export async function fetchBestSellingProducts(first: number = 8): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(GET_BEST_SELLING_PRODUCTS_QUERY, { first });
  if (!data) return [];
  return data.data?.products?.edges || [];
}

const GET_BEST_SELLING_PRODUCTS_PAGINATED_QUERY = `
  query GetBestSellingProductsPaginated($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: BEST_SELLING) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          handle
          availableForSale
          productType
          tags
          vendor
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          images(first: 5) {
            edges { node { url altText } }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                availableForSale
                quantityAvailable
                image { url altText }
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export async function fetchBestSellingProductsPaginated(first: number = 12, after?: string): Promise<ProductsResponse> {
  const data = await storefrontApiRequest(GET_BEST_SELLING_PRODUCTS_PAGINATED_QUERY, { first, after });
  if (!data) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  const productsData = data.data?.products;
  return {
    products: productsData?.edges || [],
    pageInfo: productsData?.pageInfo || { hasNextPage: false, endCursor: null },
  };
}

const GET_NEW_PRODUCTS_QUERY = `
  query GetNewProducts($first: Int!, $query: String) {
    products(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {
      edges {
        node {
          id
          title
          handle
          availableForSale
          productType
          tags
          vendor
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          images(first: 1) {
            edges { node { url altText } }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                availableForSale
                quantityAvailable
                image { url altText }
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export async function fetchNewProducts(first: number = 12, filterDays?: number): Promise<ShopifyProduct[]> {
  const variables: Record<string, unknown> = { first };
  if (filterDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filterDays);
    variables.query = `created_at:>${cutoff.toISOString().split('T')[0]}`;
  }
  const data = await storefrontApiRequest(GET_NEW_PRODUCTS_QUERY, variables);
  if (!data) return [];
  return data.data?.products?.edges || [];
}

const GET_PRODUCT_RECOMMENDATIONS_QUERY = `
  query GetProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      id
      title
      handle
      priceRange {
        minVariantPrice { amount currencyCode }
      }
      images(first: 1) {
        edges { node { url altText } }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            price { amount currencyCode }
            availableForSale
            image { url altText }
            selectedOptions { name value }
          }
        }
      }
      options { name values }
    }
  }
`;

export async function fetchProductRecommendations(productId: string): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(GET_PRODUCT_RECOMMENDATIONS_QUERY, { productId });
  if (!data) return [];
  const recommendations = data.data?.productRecommendations || [];
  return recommendations.map((node: any) => ({ node }));
}

// API Functions
export async function fetchProducts(first: number = 20, query?: string, after?: string): Promise<ProductsResponse> {
  const data = await storefrontApiRequest(GET_PRODUCTS_QUERY, { first, query, after });
  if (!data) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };

  const productsData = data.data?.products;
  return {
    products: productsData?.edges || [],
    pageInfo: productsData?.pageInfo || { hasNextPage: false, endCursor: null },
  };
}

export async function fetchProductCount(query?: string): Promise<number> {
  let total = 0;
  let after: string | undefined;
  let more = true;
  while (more) {
    const data = await storefrontApiRequest(GET_PRODUCTS_COUNT_QUERY, { query, after });
    if (!data) return total;
    const p = data.data?.products;
    total += p?.edges?.length || 0;
    more = p?.pageInfo?.hasNextPage || false;
    after = p?.pageInfo?.endCursor ?? undefined;
  }
  return total;
}

export async function fetchCollectionProductCount(handle: string): Promise<number> {
  let total = 0;
  let after: string | undefined;
  let more = true;
  while (more) {
    const data = await storefrontApiRequest(GET_COLLECTION_COUNT_QUERY, { handle, after });
    if (!data) return total;
    const p = data.data?.collection?.products;
    total += p?.edges?.length || 0;
    more = p?.pageInfo?.hasNextPage || false;
    after = p?.pageInfo?.endCursor ?? undefined;
  }
  return total;
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct['node'] | null> {
  const data = await storefrontApiRequest(GET_PRODUCT_BY_HANDLE_QUERY, { handle });
  if (!data) return null;
  return data.data?.productByHandle || null;
}

const PRODUCT_BY_HANDLE_FRAGMENT = `
  id title handle availableForSale productType tags vendor
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 20) { edges { node { url altText } } }
  variants(first: 50) {
    edges {
      node {
        id title
        price { amount currencyCode }
        availableForSale
        image { url altText }
        selectedOptions { name value }
      }
    }
  }
  options { name values }
`;

// Batch product fetch by handle — GraphQL aliases for exact match (1 request)
export async function fetchProductsByHandles(handles: string[]): Promise<Record<string, ShopifyProduct['node']>> {
  const uniqueHandles = Array.from(new Set(handles));
  if (!uniqueHandles.length) return {};
  const aliases = uniqueHandles.map((h, i) => `p${i}: productByHandle(handle: "${h}") { ${PRODUCT_BY_HANDLE_FRAGMENT} }`).join('\n');
  const data = await storefrontApiRequest(`query { ${aliases} }`, {});
  if (!data) return {};
  const result: Record<string, ShopifyProduct['node']> = {};
  for (let i = 0; i < uniqueHandles.length; i++) {
    const node = data.data?.[`p${i}`];
    if (node) result[uniqueHandles[i]] = node;
  }
  return result;
}

export async function fetchCollections(first: number = 20): Promise<ShopifyCollection[]> {
  const data = await storefrontApiRequest(GET_COLLECTIONS_QUERY, { first });
  if (!data) return [];
  return data.data?.collections?.edges?.map((e: { node: ShopifyCollection }) => e.node) || [];
}

// Fetch navigation menu by handle (e.g., "main-menu", "footer")
export async function fetchMenu(handle: string = "main-menu"): Promise<ShopifyMenu | null> {
  const data = await storefrontApiRequest(GET_MENU_QUERY, { handle });
  if (!data) return null;
  return data.data?.menu || null;
}

// Extract collection handle from a Shopify menu item URL
export function extractHandleFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    // /collections/some-handle → "some-handle"
    if (pathParts.length >= 2 && pathParts[0] === 'collections') {
      return decodeURIComponent(pathParts[1]);
    }
    // /products/some-handle → "some-handle" (for product links)
    if (pathParts.length >= 2 && pathParts[0] === 'products') {
      return decodeURIComponent(pathParts[1]);
    }
    return null;
  } catch {
    return null;
  }
}

export interface CollectionProductsResponse extends ProductsResponse {
  collectionTitle: string | null;
}

export async function fetchCollectionProducts(handle: string, first: number = 20, after?: string): Promise<CollectionProductsResponse> {
  const data = await storefrontApiRequest(GET_COLLECTION_PRODUCTS_QUERY, { handle, first, after });
  if (!data) return { products: [], pageInfo: { hasNextPage: false, endCursor: null }, collectionTitle: null };

  const collection = data.data?.collection;
  if (!collection) return { products: [], pageInfo: { hasNextPage: false, endCursor: null }, collectionTitle: null };

  return {
    products: collection.products?.edges || [],
    pageInfo: collection.products?.pageInfo || { hasNextPage: false, endCursor: null },
    collectionTitle: collection.title || null,
  };
}

export async function createStorefrontCheckout(items: { variantId: string; quantity: number }[]): Promise<string> {
   const affiliateDiscount = localStorage.getItem('affiliate_discount');
   const blocked = ['BUSINESS'];
   const discountCode = affiliateDiscount && blocked.includes(affiliateDiscount.toUpperCase()) ? null : affiliateDiscount;
   return createStorefrontCheckoutWithDiscount(items, discountCode);
 }

 // Create checkout with optional discount code for B2B members
 export async function createStorefrontCheckoutWithDiscount(
   items: { variantId: string; quantity: number }[],
   discountCode: string | null
 ): Promise<string> {
  const lines = items.map(item => ({
    quantity: item.quantity,
    merchandiseId: item.variantId,
  }));

   // Build cart input with buyer identity if logged in
   const input: Record<string, unknown> = { lines };
   if (discountCode) {
     input.discountCodes = [discountCode];
   }

   try {
     if (isCustomerLoggedIn()) {
       const storefrontToken = getCachedStorefrontCustomerToken();
       if (storefrontToken) {
         input.buyerIdentity = {
           customerAccessToken: storefrontToken,
         };
       }
     }
   } catch { /* continue without buyer identity */ }

   let data = await storefrontApiRequest(CART_CREATE_MUTATION, { input });

   // If customer token is expired/invalid, retry without it
   const tokenError = data?.data?.cartCreate?.userErrors?.some(
     (e: { field: string[]; message: string }) =>
       e.field?.includes('customerAccessToken') || e.message?.includes('invalid')
   );
   if (tokenError || !data?.data?.cartCreate?.cart) {
     console.warn('[Checkout] Customer token invalid, retrying without token');
     delete input.buyerIdentity;
     data = await storefrontApiRequest(CART_CREATE_MUTATION, { input });
   }

  if (!data) {
    throw new Error('Failed to create checkout');
  }

  if (data.data.cartCreate.userErrors.length > 0) {
    throw new Error(`Cart creation failed: ${data.data.cartCreate.userErrors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  const cart = data.data.cartCreate.cart;

  if (!cart.checkoutUrl) {
    throw new Error('No checkout URL returned from Shopify');
  }

  const url = new URL(cart.checkoutUrl);

   // Add discount code to URL as backup (in case cart discount doesn't persist)
   if (discountCode) {
     url.searchParams.set('discount', discountCode);
   }

  // Add return URL for post-checkout redirect
  const returnUrl = `${window.location.origin}/checkout-return`;
  url.searchParams.set('return_to', returnUrl);

  return url.toString();
}

// Customer data - fetch using Shopify Customer Access Token
export interface ShopifyOrder {
  id: string;
  orderNumber: number;
  name: string;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: { amount: string; currencyCode: string };
  statusUrl: string | null;
  shippingAddress: { city?: string; province?: string; country?: string } | null;
  fulfillments: Array<{ trackingCompany: string | null; trackingNumber: string | null; trackingUrl: string | null }>;
  lineItems: Array<{
    title: string;
    quantity: number;
    variant?: { image?: { url: string } } | null;
  }>;
}

export interface ShopifyCustomerProfile {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  numberOfOrders: string;
  createdAt: string;
  acceptsMarketing: boolean;
  defaultAddress: {
    address1: string | null;
    city: string | null;
    province: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  orders: ShopifyOrder[];
}

const GET_CUSTOMER_DATA_QUERY = `
  query GetCustomerData($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      displayName
      firstName
      lastName
      email
      phone
      numberOfOrders
      createdAt
      acceptsMarketing
      defaultAddress {
        address1
        city
        province
        zip
        country
      }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            orderNumber
            name
            processedAt
            financialStatus
            fulfillmentStatus
            statusUrl
            shippingAddress {
              city
              province
              country
            }
            successfulFulfillments(first: 5) {
              trackingCompany
              trackingInfo(first: 5) {
                number
                url
              }
            }
            totalPrice {
              amount
              currencyCode
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchCustomerData(customerAccessToken: string): Promise<ShopifyCustomerProfile | null> {
  const data = await storefrontApiRequest(GET_CUSTOMER_DATA_QUERY, { customerAccessToken });
  if (!data || !data.data?.customer) return null;

  const c = data.data.customer;
  return {
    displayName: c.displayName,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    numberOfOrders: c.numberOfOrders,
    createdAt: c.createdAt,
    acceptsMarketing: c.acceptsMarketing,
    defaultAddress: c.defaultAddress,
    orders: (c.orders?.edges || []).map((edge: any) => {
      const node = edge.node;
      const fulfillments = (node.successfulFulfillments || []).map((f: any) => ({
        trackingCompany: f.trackingCompany,
        trackingNumber: f.trackingInfo?.[0]?.number || null,
        trackingUrl: f.trackingInfo?.[0]?.url || null,
      }));
      return {
        id: node.id,
        orderNumber: node.orderNumber,
        name: node.name,
        processedAt: node.processedAt,
        financialStatus: node.financialStatus,
        fulfillmentStatus: node.fulfillmentStatus,
        statusUrl: node.statusUrl,
        shippingAddress: node.shippingAddress,
        fulfillments,
        totalPrice: node.totalPrice,
        lineItems: (node.lineItems?.edges || []).map((li: any) => ({
          title: li.node.title,
          quantity: li.node.quantity,
          variant: li.node.variant,
        })),
      };
    }),
  };
}

// Customer Authentication
const CUSTOMER_CREATE_MUTATION = `
  mutation customerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer { id email firstName lastName }
      customerUserErrors { field message code }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION = `
  mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken { accessToken expiresAt }
      customerUserErrors { field message code }
    }
  }
`;

export async function customerSignUp(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<{ success: boolean; error?: string; accessToken?: string }> {
  const data = await storefrontApiRequest(CUSTOMER_CREATE_MUTATION, {
    input: { email, password, firstName: firstName || '', lastName: lastName || '' },
  });

  if (!data) return { success: false, error: 'Failed to connect to server' };

  const errors = data.data?.customerCreate?.customerUserErrors || [];
  if (errors.length > 0) {
    const codes = errors.map((e: any) => e.code);
    if (codes.includes('TAKEN') || codes.includes('CUSTOMER_DISABLED')) {
      return { success: false, error: 'This email is already registered. Please log in instead.' };
    }
    return { success: false, error: errors.map((e: any) => e.message).join(', ') };
  }

  const loginResult = await customerLogin(email, password);
  return loginResult;
}

export async function customerLogin(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; accessToken?: string }> {
  const data = await storefrontApiRequest(CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION, {
    input: { email, password },
  });

  if (!data) return { success: false, error: 'Failed to connect to server' };

  const errors = data.data?.customerAccessTokenCreate?.customerUserErrors || [];
  if (errors.length > 0) {
    return { success: false, error: errors.map((e: any) => e.message).join(', ') };
  }

  const token = data.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;
  if (!token) return { success: false, error: 'Failed to get access token' };

  return { success: true, accessToken: token };
}

export async function cancelOrder(orderId: string, customerAccessToken: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/cancel-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, customerAccessToken }),
  });
  return response.json();
}

// Backward compat
export async function fetchCustomerOrders(customerAccessToken: string): Promise<ShopifyOrder[]> {
  const profile = await fetchCustomerData(customerAccessToken);
  return profile?.orders || [];
}

// Shipping rates - fetch from Shopify delivery profiles
export interface ShippingRate {
  title: string;
  amount: string;
  currencyCode: string;
}

export async function fetchShippingRates(countryCode: string = "US"): Promise<ShippingRate[]> {
  // Step 1: Get a product variant to create a temporary cart
  const productsData = await storefrontApiRequest(GET_PRODUCTS_QUERY, { first: 1 });
  if (!productsData) return [];

  const variant = productsData.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node;
  if (!variant) return [];

  // Step 2: Create cart with the variant
  const cartData = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity: 1, merchandiseId: variant.id }] },
  });
  if (!cartData) return [];

  const cartId = cartData.data?.cartCreate?.cart?.id;
  if (!cartId) return [];

  // Step 3: Update buyer identity with country to get delivery options
  const CART_BUYER_IDENTITY_UPDATE = `
    mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          deliveryGroups(first: 10) {
            edges {
              node {
                deliveryOptions {
                  title
                  estimatedCost {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const deliveryData = await storefrontApiRequest(CART_BUYER_IDENTITY_UPDATE, {
    cartId,
    buyerIdentity: {
      countryCode,
      deliveryAddressPreferences: [{ deliveryAddress: { country: countryCode } }],
    },
  });

  if (!deliveryData) return [];

  const groups = deliveryData.data?.cartBuyerIdentityUpdate?.cart?.deliveryGroups?.edges || [];
  const rates: ShippingRate[] = [];

  for (const group of groups) {
    for (const option of group.node.deliveryOptions || []) {
      rates.push({
        title: option.title,
        amount: option.estimatedCost.amount,
        currencyCode: option.estimatedCost.currencyCode,
      });
    }
  }

  return rates;
}

// Format price helper
export function formatPrice(amount: string, currencyCode: string): string {
  const numAmount = parseFloat(amount);

  // Use appropriate locale based on currency
  const localeMap: Record<string, string> = {
    'JPY': 'ja-JP',
    'USD': 'en-US',
    'CAD': 'en-CA',
    'KRW': 'ko-KR',
    'HKD': 'en-HK',
    'SGD': 'en-SG',
    'EUR': 'en-IE',
    'GBP': 'en-GB',
  };

  const locale = localeMap[currencyCode] || 'en-US';

  const noDecimalCurrencies = ['KRW', 'JPY'];
  const useNoDecimals = noDecimalCurrencies.includes(currencyCode);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: useNoDecimals ? 0 : 2,
    maximumFractionDigits: useNoDecimals ? 0 : 2,
  }).format(numAmount);
}
