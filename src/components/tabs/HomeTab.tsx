import React from "react";
import { Compass, LayoutGrid, Layers, Paintbrush } from 'lucide-react';
import { Squircle } from "../ui/Squircle";
import { TipCard } from "../ui/TipCard";
import { Logo } from "../Logo";
import { useTranslation } from "../../lib/i18n";

export default function HomeTab() {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full animate-in fade-in zoom-in-95 duration-300 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2 flex flex-col gap-6 pb-6 pr-2 -mr-2">
      <div
        className="w-full bg-zinc-200 dark:bg-zinc-800 text-white rounded-4xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 overflow-hidden relative border border-zinc-500/25 dark:border-zinc-700/30"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-blue-500 rounded-full filter blur-[100px] opacity-40 mix-blend-screen"></div>
          <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-emerald-500 rounded-full filter blur-[100px] opacity-30 mix-blend-screen"></div>
          <div className="absolute top-1/4 -right-16 w-56 h-56 bg-purple-500 rounded-full filter blur-[100px] opacity-40 mix-blend-screen"></div>
        </div>

        <div className="flex flex-col gap-2 text-center md:text-start max-w-lg relative z-10">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">WidgBar Desktop</span>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("bannerWelcome")}</h1>
          <p className="text-sm text-zinc-300 leading-relaxed mt-1">{t("bannerDesc")}</p>
        </div>

        <Logo className="w-20 h-20 drop-shadow-2xl brightness-110" />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 px-1">
          {t("tipsSectionTitle")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TipCard
            icon={Compass}
            iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20"
            iconColorClass="text-indigo-500"
            title={t("tipSnappingTitle")}
            description={t("tipSnappingDesc")}
          />
          <TipCard
            icon={LayoutGrid}
            iconBgClass="bg-purple-500/10 dark:bg-purple-500/20"
            iconColorClass="text-purple-500"
            title={t("tipEditModeTitle")}
            description={t("tipEditModeDesc")}
          />
          <TipCard
            icon={Layers}
            iconBgClass="bg-pink-500/10 dark:bg-pink-500/20"
            iconColorClass="text-pink-500"
            title={t("tipDualPlacementTitle")}
            description={t("tipDualPlacementDesc")}
          />
          <TipCard
            icon={Paintbrush}
            iconBgClass="bg-rose-500/10 dark:bg-rose-500/20"
            iconColorClass="text-rose-500"
            title={t("tipAestheticsTitle")}
            description={t("tipAestheticsDesc")}
          />
        </div>
      </div>
    </div>
  );
}
