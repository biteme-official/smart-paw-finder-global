import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const IMAGE_BASE = "https://www.biteme.co.kr/asset/images/company/detail";

const popupStores = [
  { id: 0, title: "2023 Superzoo Las Vegas", images: 7 },
  { id: 1, title: "2024 Interpets Tokyo", images: 7 },
  { id: 2, title: "The Hyundai Seoul", images: 7 },
  { id: 3, title: "Starfield Goyang", images: 6 },
  { id: 4, title: "Millac the Market Busan", images: 7 },
  { id: 5, title: "Lotte Mall Suwon", images: 7 },
  { id: 6, title: "Hyundai City Outlets", images: 7 },
  { id: 7, title: "Niceweather Garosugil", images: 7 },
  { id: 8, title: "Hyundai Trade Center", images: 7 },
  { id: 9, title: "Kyobo Bookstore Jamsil", images: 4 },
];

function ImageModal({
  store,
  onClose,
}: {
  store: (typeof popupStores)[0];
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const total = store.images;

  const prev = () => setCurrent((c) => (c - 1 + total) % total);
  const next = () => setCurrent((c) => (c + 1) % total);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-background rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">{store.title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <img
            src={`${IMAGE_BASE}/project03_${store.id}_${current + 1}.jpg`}
            alt={`${store.title} ${current + 1}`}
            className="w-full h-full object-contain"
          />
          {total > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex justify-center gap-1.5 py-3">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const PopupOffline = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<(typeof popupStores)[0] | null>(null);

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1">
        <PageHeader
          title={<>BITE ME<br />EVERYWHERE</>}
          description={<>BITE ME has operated over 30 pop-up shops<br />and offline stores across the country!</>}
        />

        <section>
        <PageContainer className="pb-16">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {popupStores.map((store) => (
              <button
                key={store.id}
                onClick={() => setSelectedStore(store)}
                className="group relative aspect-[4/3] overflow-hidden bg-secondary"
              >
                <img
                  src={`${IMAGE_BASE}/project03_${store.id}_main.jpg`}
                  alt={store.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                  <span className="text-white text-xs md:text-sm font-medium text-left leading-tight">
                    {store.title}
                  </span>
                  <span className="text-white/80 text-lg leading-none ml-2">&#10095;</span>
                </div>
              </button>
            ))}
          </div>
        </PageContainer>
        </section>
      </main>

      {selectedStore && (
        <ImageModal store={selectedStore} onClose={() => setSelectedStore(null)} />
      )}

      <Footer />
    </div>
  );
};

export default PopupOffline;
