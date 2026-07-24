import { 
  Sparkles, 
  Monitor, 
  Clipboard, 
  Music, 
  Bot, 
  Plus, 
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import { Logo } from "../Logo";
import { useTranslation } from "../../lib/i18n";
import { useUIStore } from "../../stores/uiStore";

export default function HomePanel() {
  const { t, language } = useTranslation();
  const { setActiveTab } = useUIStore();
  const isFarsi = language === 'fa';

  const scrollToFeatures = () => {
    const element = document.getElementById('features-section');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="w-full h-full text-zinc-900 dark:text-zinc-100 overflow-y-auto scroll-smooth custom-scrollbar flex flex-col bg-transparent">
      
      {/* ===== Hero Section (Light / Dark Mode Responsive with CSS Ambient Glows) ===== */}
      <div className="w-full min-h-[450px] bg-white/80 dark:bg-zinc-950/70 animate-in fade-in slide-in-from-bottom-4 duration-200 text-zinc-900 dark:text-white rounded-b-[40px] flex flex-col items-center justify-center shrink-0 overflow-hidden relative border-b border-zinc-200/80 dark:border-zinc-800/80 py-14 px-6 shadow-lg dark:shadow-2xl backdrop-blur-md">
        
        {/* Lightweight Static CSS Ambient Glows (Responsive Opacity) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full filter blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[250px] bg-blue-500/10 rounded-full filter blur-[100px]" />
          <div className="absolute -bottom-20 right-1/4 w-[450px] h-[250px] bg-sky-500/10 rounded-full filter blur-[110px]" />
        </div>

        {/* Centered Hero Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl gap-5 my-auto">
          
          {/* Logo with Cyan Ambient Glow */}
          <div className="relative flex items-center justify-center mb-1">
            <div className="absolute inset-0 bg-cyan-500/20 dark:bg-cyan-500/25 rounded-full blur-3xl" />
            <Logo className="w-24 h-24 md:w-28 md:h-28 drop-shadow-[0_12px_35px_rgba(14,165,233,0.35)]" />
          </div>


          {/* Main Title */}
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
            {isFarsi ? "میزکار هوشمند و زیبای شما" : t("bannerWelcome")}
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal max-w-lg">
            {isFarsi 
              ? "دسترسی سریع به ویجت‌ها، هوش مصنوعی، کلیپ‌بورد و پلیر موزیک در تمام مانیتورهای شما با طراحی مدرن و سبک."
              : t("bannerDesc")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <button
              onClick={() => setActiveTab("widgets_library")}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs md:text-sm shadow-xl shadow-cyan-500/20 flex items-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>{isFarsi ? "ساخت اولین ویجت" : "Create First Widget"}</span>
            </button>

            <button
              onClick={() => setActiveTab("layout")}
              className="px-7 py-3.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/10 backdrop-blur-md font-medium text-xs md:text-sm flex items-center gap-2.5 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{isFarsi ? "تنظیمات چیدمان" : "Layout Settings"}</span>
            </button>
          </div>

          {/* Scroll Indicator */}
          <button 
            onClick={scrollToFeatures}
            className="mt-6 text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer flex flex-col items-center gap-1 text-[11px]"
            title={isFarsi ? "مشاهده ویژگی‌ها" : "View Features"}
          >
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </button>
        </div>
      </div>


      {/* ===== Features Section (Light / Dark Glass Cards) ===== */}
      <div id="features-section" className="w-full bg-transparent px-6 md:px-10 py-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-200 delay-200 fill-mode-backwards">
        
        <div className="w-full max-w-5xl flex flex-col gap-8">
          
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl md:text-2xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-3">
              <LayoutGrid className="w-6 h-6 text-zinc-400" />
              <span>{isFarsi ? "ویژگی‌ها و قابلیت‌های WidgBar" : "WidgBar Features"}</span>
            </h2>
          </div>

          {/* Feature Cards Grid (Ultra-Rounded [44px]) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Card 1: Create First Widget */}
            <div className="p-8 rounded-[44px] bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600/60 hover:bg-white/90 dark:hover:bg-zinc-900/70 flex flex-col gap-4 shadow-sm hover:shadow-md transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-[22px] bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                  <Plus className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isFarsi ? "ساخت اولین ویجت" : "Create Your First Widget"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isFarsi ? "افزودن آسان به نوار بالا یا دسکتاپ" : "Easy addition to Bar or Desktop"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                {isFarsi 
                  ? "از تب «کتابخانه ویجت‌ها» یا «چیدمان»، ویجت‌های دلخواه خود (ساعت، هوش مصنوعی، موزیک، کلیپ‌بورد و...) را انتخاب کرده و تنها با یک کلیک به نوار بالای مانیتور یا بوم دسکتاپ اضافه کنید."
                  : "Choose widgets (Clock, AI, Music, Clipboard...) from Widget Library or Layout tab and add them with one click."}
              </p>
              <button
                onClick={() => setActiveTab("widgets_library")}
                className="mt-1 self-start text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isFarsi ? "ورود به کتابخانه ویجت‌ها ➔" : "Go to Widget Library ➔"}</span>
              </button>
            </div>

            {/* Card 2: Bar vs Desktop Widgets */}
            <div className="p-8 rounded-[44px] bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600/60 hover:bg-white/90 dark:hover:bg-zinc-900/70 flex flex-col gap-4 shadow-sm hover:shadow-md transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-[22px] bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                  <Monitor className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isFarsi ? "نوار بالای مانیتور (Bar) و ویجت‌های دسکتاپ" : "Bar & Desktop Widgets"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isFarsi ? "دو محیط چیدمان مجزا و هوشمند" : "Dual layout environments"}
                  </p>
                </div>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-2 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <p>
                  • <strong>{isFarsi ? "نوار Bar:" : "Bar:"}</strong> {isFarsi ? "نوار باریک و همیشه‌روشن بالای صفحه برای دسترسی سریع." : "Slim top bar for fast quick actions."}
                </p>
                <p>
                  • <strong>{isFarsi ? "ویجت دسکتاپ:" : "Desktop:"}</strong> {isFarsi ? "ویجت‌های شناور دسکتاپ با چسبندگی مغناطیسی (Snap Margin)." : "Floating desktop widgets with magnetic snapping."}
                </p>
              </div>
            </div>

            {/* Card 3: Clipboard Features */}
            <div className="p-8 rounded-[44px] bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600/60 hover:bg-white/90 dark:hover:bg-zinc-900/70 flex flex-col gap-4 shadow-sm hover:shadow-md transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-[22px] bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                  <Clipboard className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isFarsi ? "مدیریت کلیپ‌بورد و همگام‌سازی dual" : "Dual Clipboard Manager"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isFarsi ? "سازگار با VS Code و Windows Explorer" : "VS Code & Explorer formats supported"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                {isFarsi 
                  ? "ذخیره خودکار متون، تصاویر و فایل‌ها. فایلهای کپی‌شده در VS Code به‌طور مستقیم در Explorer و برنامه‌ها Paste می‌شوند. با امکان Pin و Freeze."
                  : "Auto saves text, images, and files. Files copied in VS Code paste directly in Explorer and apps with Pin/Freeze features."}
              </p>
            </div>

            {/* Card 4: Music Player Features */}
            <div className="p-8 rounded-[44px] bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600/60 hover:bg-white/90 dark:hover:bg-zinc-900/70 flex flex-col gap-4 shadow-sm hover:shadow-md transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-[22px] bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                  <Music className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isFarsi ? "پخش‌کننده موزیک سیستم" : "System Music Player"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isFarsi ? "تشخیص خودکار رسانه فعال" : "Auto media session detection"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                {isFarsi 
                  ? "تشخیص هوشمند پخش موزیک از Spotify، Chrome، Edge و غیره. همراه با کاور آلبوم باکیفیت و دکمه‌های کنترلی."
                  : "Auto detects playing media from Spotify, Chrome, Edge, etc. displaying album cover and playback controls."}
              </p>
            </div>

            {/* Card 5: AI Services Features (Full Width) */}
            <div className="md:col-span-2 p-8 rounded-[44px] bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600/60 hover:bg-white/90 dark:hover:bg-zinc-900/70 flex flex-col gap-4 shadow-sm hover:shadow-md transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-[22px] bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isFarsi ? "سرویس‌های هوش مصنوعی و چت شناور" : "AI Services & Dynamic Chat"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isFarsi ? "پشتیبانی از پرووایدرهای متنوع و پرسش از کلیپ‌بورد" : "ChatGPT, Gemini, Ollama & Clipboard integration"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                {isFarsi 
                  ? "تعریف پرووایدرهای مختلف AI، امکان پرسش مستقیم روی هر آیتم کلیپ‌بورد با یک کلیک، و باز شدن پنجره چت اختصاصی هوشمند بدون تداخل با سایر بخش‌ها."
                  : "Configure custom AI providers, ask questions directly on any clipboard item with one click, and open dedicated dynamic chat windows."}
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
