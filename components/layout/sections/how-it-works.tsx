"use client";

import { useI18n } from "@/lib/i18n/provider";

const stepKeys = ["step1", "step2", "step3"] as const;

export const HowItWorksSection = () => {
  const { t } = useI18n();

  return (
    <section id="how-it-works" className="relative py-20 sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-5rem] h-60 w-60 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute bottom-[-7rem] right-[-5rem] h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl sm:h-80 sm:w-80 dark:bg-cyan-300/10" />
      </div>

      <div className="container">
        <div className="mx-auto max-w-4xl text-center sm:max-w-5xl">
          <span className="app-card-muted inline-flex items-center rounded-full border border-primary/20 px-4 py-2 text-sm font-medium text-primary">
            {t("homeStepsSection.badge")}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
            {t("homeStepsSection.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("homeStepsSection.subtitle")}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-3">
          {stepKeys.map((stepKey, index) => (
            <article
              key={stepKey}
              className="group app-card app-hairline relative h-full rounded-[24px] px-6 pb-7 pt-14 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(2,8,23,0.14)] sm:px-7 sm:pt-16 dark:hover:shadow-[0_24px_58px_rgba(0,0,0,0.38)]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-5 top-0 h-20 rounded-b-[18px] bg-gradient-to-b from-primary/10 to-transparent"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-primary text-xl font-semibold text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/0.36)]"
              >
                {index + 1}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55 dark:text-white/50">
                {`Step ${String(index + 1).padStart(2, "0")}`}
              </span>
              <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.95rem]">
                {t(`homeStepsSection.steps.${stepKey}.title`)}
              </h3>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-[1.04rem]">
                {t(`homeStepsSection.steps.${stepKey}.description`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
