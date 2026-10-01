export function SiteFooter() {
  return (
    <footer className="hidden border-t border-border/60 bg-card/40 md:block">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Evios Trader" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-bold">Evios Trader</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Trade crypto, forex and stocks on a unified premium platform.</p>
        </div>
        {[
          { title: "Products", items: ["Spot", "Futures", "Copy Trading", "Earn"] },
          { title: "Company", items: ["About", "Careers", "Press", "Blog"] },
          { title: "Support", items: ["Help Center", "Fees", "API Docs", "Status"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.items.map((i) => (
                <li key={i} className="hover:text-foreground transition-colors cursor-pointer">{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Evios Trader — Demo platform. Not financial advice.
      </div>
    </footer>
  );
}