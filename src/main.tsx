import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initKlaviyo } from "./lib/klaviyo";

// Klaviyo 사이트 추적 (B2B 사이트는 EU·EEA·영국·스위스 방문자에게 로드하지 않음)
void initKlaviyo();

createRoot(document.getElementById("root")!).render(<App />);
