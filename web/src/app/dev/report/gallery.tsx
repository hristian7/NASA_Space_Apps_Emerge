"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import type { CountryFile, ReportedFile } from "@/types/data";
import type { Series } from "@/types/ui";
import {
  ChanceCard,
  DataTable,
  DownloadsMenu,
  ExtremesSummary,
  FireCalendar,
  Glossary,
  ReportedCard,
  SatelliteTable,
  TrendChart,
  UnitToggle,
  UnusualCard,
  WindowCard,
} from "@/components/report";
import reportStyles from "@/components/report/styles";
import type { MonthKey, UnitMode } from "@/components/report/types";
import type { ReportLocale } from "@/components/report/lib/format";
import { svgToPng } from "@/lib/export/png";
import {
  anomalyPointsFromSeries,
  satelliteMonthsFromCountryFile,
  seriesFromCountryFile,
  yearTotals,
} from "./adapter";
import * as fixtures from "./fixtures";
import styles from "./dev-styles";

export type Look = "ember" | "field" | "ops";

export interface GalleryProps {
  look: Look;
  locale: ReportLocale;
  messages: Record<string, unknown>;
}

interface PlaceData {
  iso3: string;
  name: string;
  country: CountryFile;
  reported: ReportedFile | null;
}

const PLACES: { iso3: string; name: string }[] = [
  { iso3: "BGR", name: "Bulgaria" },
  { iso3: "USA", name: "United States" },
];

export default function Gallery({ look, locale, messages }: GalleryProps) {
  const [places, places_set] = useState<PlaceData[] | null>(null);
  const [failure, failure_set] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const loaded = await Promise.all(
          PLACES.map(async (place) => {
            const country = (await fetchJson(
              `/data/countries/${place.iso3}.json`,
            )) as CountryFile;
            let reported: ReportedFile | null = null;
            try {
              reported = (await fetchJson(
                `/data/reported/${place.iso3}.json`,
              )) as ReportedFile;
            } catch {
              reported = null;
            }
            return { ...place, country, reported };
          }),
        );
        if (live) {
          places_set(loaded);
        }
      } catch (error) {
        if (live) {
          failure_set(error instanceof Error ? error.message : String(error));
        }
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className={styles.page} data-look={look} lang={locale}>
        <header className={styles.top}>
          <h1 className={styles.title}>Report panel, every component</h1>
          <nav className={styles.switches} aria-label="Design direction">
            {(["ember", "field", "ops"] as Look[]).map((option) => (
              <a
                key={option}
                className={`${styles.switch} ${option === look ? styles.switchOn : ""}`}
                href={`?d=${option}&lang=${locale}`}
              >
                {option}
              </a>
            ))}
          </nav>
          <nav className={styles.switches} aria-label="Language">
            {(["en", "bg"] as ReportLocale[]).map((option) => (
              <a
                key={option}
                className={`${styles.switch} ${option === locale ? styles.switchOn : ""}`}
                href={`?d=${look}&lang=${option}`}
              >
                {option}
              </a>
            ))}
          </nav>
        </header>

        {failure !== null ? (
          <p className={styles.state}>The example data did not load: {failure}</p>
        ) : null}
        {places === null && failure === null ? (
          <p className={styles.state}>Loading the example data.</p>
        ) : null}

        <div className={styles.columns}>
          {(places ?? []).map((place, i) => (
            <PlaceReport
              key={place.iso3}
              place={place}
              locale={locale}
              exposePngHook={i === 0}
            />
          ))}
          {places === null ? null : <EdgeCases locale={locale} />}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

async function fetchJson(address: string): Promise<unknown> {
  const response = await fetch(address);
  if (!response.ok) {
    throw new Error(`${address} answered ${response.status}`);
  }
  return response.json();
}

function PlaceReport({
  place,
  locale,
  exposePngHook,
}: {
  place: PlaceData;
  locale: ReportLocale;
  exposePngHook: boolean;
}) {
  const [mode, mode_set] = useState<UnitMode>("cd");
  const [selected, selected_set] = useState<MonthKey | null>({
    y: 2024,
    m: 8,
  });
  const calendarRef = useRef<SVGSVGElement | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const series: Series = useMemo(
    () => seriesFromCountryFile(place.country, mode === "hot" ? "hot" : "cd"),
    [place.country, mode],
  );
  const anomaly = useMemo(() => anomalyPointsFromSeries(series), [series]);
  const totals = useMemo(() => yearTotals(series), [series]);
  const satelliteMonths = useMemo(
    () => satelliteMonthsFromCountryFile(place.country, 24),
    [place.country],
  );

  const dates = `${place.country.first_month} to ${place.country.last_month}`;
  const unitShortKey = mode === "hot" ? "hot" : "cd";

  useEffect(() => {
    if (!exposePngHook) {
      return;
    }
    const hook = async () => {
      const svg = calendarRef.current;
      if (svg === null) {
        throw new Error("The calendar is not on screen.");
      }
      const result = await svgToPng(svg, {
        caption: {
          title: "Fire calendar",
          place: place.name,
          dates,
        },
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("The PNG could not be read."));
        reader.readAsDataURL(result.blob);
      });
      const ink = await countInk(dataUrl, result.width, result.captionHeight);
      return {
        width: result.width,
        height: result.height,
        sourceWidth: result.sourceWidth,
        sourceHeight: result.sourceHeight,
        captionHeight: result.captionHeight,
        titleInkPixels: ink.title,
        bodyInkPixels: ink.body,
        distinctColours: ink.colours,
        dataUrl,
      };
    };
    (window as unknown as Record<string, unknown>).__emergeReportPng = hook;
    return () => {
      delete (window as unknown as Record<string, unknown>)
        .__emergeReportPng;
    };
  }, [exposePngHook, place.name, dates]);

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{place.name}</h2>
      <p className={styles.panelSub}>
        {place.country.iso3} · {dates} · example data
      </p>

      <div className={reportStyles.report}>
        <UnitToggle value={mode} onChange={mode_set} />

        {mode === "sat" ? (
          <SatelliteTable months={satelliteMonths} locale={locale} />
        ) : (
          <FireCalendar
            series={series}
            locale={locale}
            mode={mode}
            anomaly={anomaly}
            yearTotals={totals}
            selected={selected}
            onSelect={selected_set}
            svgRef={calendarRef}
          />
        )}

        <SelectionLine selected={selected} />

        <ExtremesSummary
          extremes={fixtures.extremes}
          trend={fixtures.trend}
          locale={locale}
          unitShortKey={unitShortKey}
        />

        <div className={reportStyles.cards}>
          <UnusualCard
            unusual={fixtures.unusualAbove}
            year={selected?.y ?? 2024}
            month={selected?.m ?? 8}
            locale={locale}
          />
          <ChanceCard
            chance={fixtures.chanceSmallArea}
            month={selected?.m ?? 8}
            locale={locale}
          />
        </div>

        <WindowCard comparison={fixtures.windowComparison} locale={locale} />

        <TrendChart
          years={totals}
          trend={fixtures.trend}
          locale={locale}
          unitShortKey={unitShortKey}
          svgRef={chartRef}
        />

        <ReportedCard
          reported={place.reported}
          satelliteYears={totals}
          scope="country"
          locale={locale}
          unitShortKey={unitShortKey}
        />

        <SatelliteTable months={satelliteMonths} locale={locale} />

        <DataTable series={series} locale={locale} />

        <DownloadsMenu
          onHotspotsCsv={() => undefined}
          onMonthlyCsv={() => undefined}
          onSummaryCsv={() => undefined}
          calendarRef={calendarRef}
          chartRef={chartRef}
          place={place.name}
          dates={dates}
        />
      </div>
    </section>
  );
}

function SelectionLine({ selected }: { selected: MonthKey | null }) {
  return (
    <p className={styles.state}>
      onSelect reported:{" "}
      {selected === null ? "nothing yet" : `${selected.y}-${selected.m}`}
    </p>
  );
}

/** Every remaining state of every card, from the hand-written fixtures. */
function EdgeCases({ locale }: { locale: ReportLocale }) {
  const t = useTranslations("report");
  const [mode, mode_set] = useState<UnitMode>("anomaly");
  const [selected, selected_set] = useState<MonthKey | null>({
    y: 2011,
    m: 8,
  });

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Every other state</h2>
      <p className={styles.panelSub}>
        Hand-written fixtures. Not measurements. {t("glossary.heading")}.
      </p>

      <div className={reportStyles.report}>
        <UnitToggle value={mode} onChange={mode_set} disabled={["sat"]} />
        <FireCalendar
          series={fixtures.edgeSeries}
          locale={locale}
          mode={mode}
          anomaly={fixtures.edgeAnomaly}
          selected={selected}
          onSelect={selected_set}
          label="Fire calendar, every cell state"
        />

        <div className={reportStyles.cards}>
          <UnusualCard
            unusual={fixtures.unusualNear}
            year={2011}
            month={8}
            locale={locale}
          />
          <UnusualCard
            unusual={fixtures.unusualBelow}
            year={2011}
            month={8}
            locale={locale}
          />
          <UnusualCard
            unusual={fixtures.unusualNoHistory}
            year={2011}
            month={3}
            locale={locale}
          />
          <UnusualCard
            unusual={fixtures.unusualTooEarly}
            year={2026}
            month={11}
            locale={locale}
            monthToDate
          />
          <UnusualCard
            unusual={fixtures.unusualMedianZero}
            year={2011}
            month={2}
            locale={locale}
          />
          <ChanceCard
            chance={fixtures.chanceLargeArea}
            month={8}
            locale={locale}
            largeArea
            expectedFireDays={fixtures.expectedFireDaysLargeArea}
          />
          <ChanceCard
            chance={fixtures.chanceNoHistory}
            month={2}
            locale={locale}
          />
          <ReportedCard
            reported={null}
            satelliteYears={[]}
            scope="area"
            locale={locale}
          />
        </div>

        <WindowCard comparison={fixtures.windowNoPast} locale={locale} />

        <ExtremesSummary
          extremes={fixtures.extremesEmpty}
          trend={fixtures.trendTooShort}
          locale={locale}
        />

        <SatelliteTable months={[]} locale={locale} />

        <DataTable series={fixtures.edgeSeries} locale={locale} />

        <hr className={styles.divider} />

        <Glossary />
      </div>
    </section>
  );
}

async function countInk(
  dataUrl: string,
  width: number,
  captionHeight: number,
): Promise<{ title: number; body: number; colours: number }> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("No drawing context for the ink check.");
  }
  context.drawImage(image, 0, 0);

  const band = context.getImageData(0, 0, width, captionHeight).data;
  const rest = context.getImageData(
    0,
    captionHeight,
    width,
    canvas.height - captionHeight,
  ).data;

  const first = `${band[0]},${band[1]},${band[2]}`;
  let title = 0;
  for (let i = 0; i < band.length; i += 4) {
    if (`${band[i]},${band[i + 1]},${band[i + 2]}` !== first) {
      title += 1;
    }
  }

  const colours = new Set<string>();
  let body = 0;
  for (let i = 0; i < rest.length; i += 4) {
    const key = `${rest[i]},${rest[i + 1]},${rest[i + 2]}`;
    colours.add(key);
    if (key !== first) {
      body += 1;
    }
  }

  return { title, body, colours: colours.size };
}
