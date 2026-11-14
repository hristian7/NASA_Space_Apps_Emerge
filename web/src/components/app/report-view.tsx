"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Bbox } from "@/lib/hotspots/geo";
import type { MetaFile, ReportedFile } from "@/types/data";
import type { SatelliteMonth, Selection, Series } from "@/types/ui";
import {
  ChanceCard,
  DataTable,
  DownloadsMenu,
  ExtremesSummary,
  FireCalendar,
  Glossary,
  OutsideLinks,
  ReportedCard,
  SatelliteTable,
  TrendChart,
  UnitToggle,
  UnusualCard,
  WindowCard,
} from "@/components/report";
import CumulativeChart from "@/components/report/CumulativeChart";
import reportStyles from "@/components/report/styles";
import type { MonthKey, UnitMode } from "@/components/report/types";
import {
  formatCount,
  monthLong,
  monthYearLong,
  monthYearShort,
  formatIsoDate,
  type ReportLocale,
} from "@/components/report/lib/format";
import { yearTotalsFromSeries } from "@/components/report/lib/aggregate";
import {
  backgroundStatus,
  getMeta,
  getMonthToDate,
  getPerSatellite,
  getReported,
  getSeries,
  getWindowTotals,
  loadCountryIndex,
} from "@/lib/data/api";
import { chance, extremes, rankWindow, trend, unusual, unusualToDate } from "@/lib/stats";
import { MAX_ROWS } from "@/lib/hotspots/query";
import { encodeSelection } from "@/lib/ui/selection-url";
import { useCountryName } from "./country-name";
import { decodeView, defaultView, viewSearch, type ViewState } from "@/lib/ui/view-url";
import {
  anomalyPoints,
  clipByMonth,
  clipSeries,
  daysSoFar,
  lastCompleteMonth,
  hotspotsLink,
  isLargeArea,
  monthRank,
  historyYears,
  monthsOf,
  noFireEver,
  provenance,
  pointAt,
  sameMonth,
  unfinishedMonthOf,
  resolveMonth,
  scopeOf,
  typicalFireDays,
} from "./adapter";
import { csvFilename, csvHeader, monthlyFile, saveText, summaryFile } from "./downloads";
import CountryTest from "./country-test";
import DateRange from "./date-range";
import styles from "./app-styles";

/** Everything one selection needs, loaded once and kept until it changes. */
interface Loaded {
  key: string;
  meta: MetaFile;
  fireDays: Series;
  hotspots: Series;
  satellites: SatelliteMonth[] | null;
  reported: ReportedFile | null;
  /** The selected country's own box and middle, for the hotspots link. */
  countryBox: Bbox | null;
  countryLon: number | null;
  window: Awaited<ReturnType<typeof getWindowTotals>> | null;
  monthToDate: Awaited<ReturnType<typeof getMonthToDate>> | null;
  /** True when the pre-2012 background or its factors could not be read. */
  backgroundMissing: boolean;
}

export default function ReportView({ selection }: { selection: Selection }) {
  const t = useTranslations("app");
  const countryName = useCountryName(
    selection.kind === "country" ? selection.iso3 : null,
  );
  const locale = useLocale() as ReportLocale;

  const key = useMemo(() => encodeSelection(selection), [selection]);
  const [view, setView] = useState<ViewState>(defaultView);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const calendarRef = useRef<SVGSVGElement | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  // The address bar is the source of truth on arrival, so a copied link opens
  // the same unit, month and range.
  useEffect(() => {
    setView(decodeView(window.location.search));
  }, []);

  const apply = useCallback((next: ViewState) => {
    setView(next);
    const search = viewSearch(window.location.search, next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, []);

  useEffect(() => {
    let live = true;
    setFailure(null);
    setLoaded((held) => (held !== null && held.key === key ? held : null));

    async function load() {
      const meta = await getMeta();
      const [fireDays, hotspots] = await Promise.all([
        getSeries(selection, "cd"),
        getSeries(selection, "hot"),
      ]);
      // Read straight after the series runs, which is what sets it.
      const background = backgroundStatus();
      // meta lists the countries an authority publishes figures for. Asking
      // for a file that is not there answers null, but the browser still
      // prints a 404, so the list is read first.
      const hasReported =
        selection.kind !== "country" || meta.reported.includes(selection.iso3);
      const [satellites, reported, index] = await Promise.all([
        getPerSatellite(selection),
        hasReported ? getReported(selection).catch(() => null) : Promise.resolve(null),
        selection.kind === "country"
          ? loadCountryIndex().catch(() => null)
          : Promise.resolve(null),
      ]);
      const entry =
        selection.kind === "country"
          ? (index?.countries.find((row) => row.iso3 === selection.iso3) ?? null)
          : null;
      const [windowTotals, toDate] = await Promise.all([
        getWindowTotals(selection).catch(() => null),
        getMonthToDate(selection).catch(() => null),
      ]);
      return {
        key,
        meta,
        fireDays,
        hotspots,
        satellites,
        reported,
        countryLon: entry?.lon ?? null,
        countryBox:
          entry === null
            ? null
            : {
                west: entry.bbox[0],
                south: entry.bbox[1],
                east: entry.bbox[2],
                north: entry.bbox[3],
              },
        window: windowTotals,
        monthToDate: toDate,
        backgroundMissing:
          selection.kind !== "country" &&
          (!background.loaded || background.unscaledDays > 0),
      } satisfies Loaded;
    }

    void load().then(
      (result) => {
        if (live) setLoaded(result);
      },
      (error: unknown) => {
        if (live) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      },
    );

    return () => {
      live = false;
    };
  }, [key, selection, attempt]);

  if (failure !== null) {
    return (
      <>
        <p className={styles.state} role="alert" data-testid="report-failed">
          {t("failed")}
        </p>
        <p className="rp-sub">{t("failedDetail", { reason: failure })}</p>
        <button
          type="button"
          className={`rp-btn ${styles.retry}`}
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t("retry")}
        </button>
      </>
    );
  }

  if (loaded === null || loaded.key !== key) {
    return (
      <p className={styles.state} data-testid="report-loading">
        {t("loading")}
      </p>
    );
  }

  return (
    <Report
      data={loaded}
      selection={selection}
      view={view}
      onView={apply}
      locale={locale}
      t={t}
      countryName={countryName}
      calendarRef={calendarRef}
      chartRef={chartRef}
    />
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

function Report({
  data,
  selection,
  view,
  onView,
  locale,
  t,
  countryName,
  calendarRef,
  chartRef,
}: {
  data: Loaded;
  selection: Selection;
  view: ViewState;
  onView: (next: ViewState) => void;
  locale: ReportLocale;
  t: Translate;
  countryName: string;
  calendarRef: React.RefObject<SVGSVGElement | null>;
  chartRef: React.RefObject<SVGSVGElement | null>;
}) {
  const mode = view.unit;
  const full = mode === "hot" ? data.hotspots : data.fireDays;
  const months = useMemo(() => monthsOf(full), [full]);

  const first = months[0] ?? { y: 2000, m: 11 };
  const last = months[months.length - 1] ?? first;
  const from = view.from !== null && inRecord(months, view.from) ? view.from : first;
  const to = view.to !== null && inRecord(months, view.to) ? view.to : last;

  // Every figure on screen and in the files comes from the same clipped
  // series, so a narrowed range never makes the page and the download differ.
  const series = useMemo(() => clipSeries(full, from, to), [full, from, to]);
  const fireDaysInRange = useMemo(
    () => clipSeries(data.fireDays, from, to),
    [data.fireDays, from, to],
  );
  const anomaly = useMemo(() => {
    const points = anomalyPoints(full);
    return clipByMonth(points, from, to);
  }, [full, from, to]);

  // The record's own calendar, read from meta rather than from the series:
  // a month with no measurement is still a month of the record.
  const unfinished = unfinishedMonthOf(data.meta.last_data_day);
  const defaultMonth = lastCompleteMonth(data.meta.last_data_day);
  const selectedMonth = resolveMonth(series, view.month ?? defaultMonth);
  // The report package's own summing, which applies no rule from the number
  // logic: it adds the months already on screen.
  const yearTotals = useMemo(() => yearTotalsFromSeries(series), [series]);

  const theExtremes = useMemo(() => extremes(series), [series]);
  const theTrend = useMemo(() => trend(series), [series]);

  // The selected month is the part month the record stops inside.
  const partMonth = sameMonth(selectedMonth, unfinished);
  const daysHeld = daysSoFar(data.meta.last_data_day);
  // Days 1 to D against the same days in past years comes from the daily
  // files, which hold grid squares and not countries, and which answer null
  // for a day the record has no measurement for.
  const toDateReady =
    partMonth &&
    selection.kind !== "country" &&
    data.monthToDate !== null &&
    data.monthToDate.current.hot !== null;
  const monthToDate = toDateReady;
  const selectedPoint =
    selectedMonth === null ? undefined : pointAt(series, selectedMonth);

  const theUnusual = useMemo(() => {
    if (selectedMonth === null) return null;
    if (partMonth) {
      if (!toDateReady || data.monthToDate === null) return null;
      const toDate = data.monthToDate;
      return unusualToDate(
        toDate.current.hot,
        toDate.past
          .map((year) => year.hot)
          .filter((value): value is number => value !== null),
        toDate.day,
      );
    }
    // A month with no measurement has nothing to compare, which is a different
    // thing from having too few past years.
    if (pointAt(series, selectedMonth)?.value == null) return null;
    return unusual(series, selectedMonth.y, selectedMonth.m);
  }, [series, selectedMonth, partMonth, toDateReady, data.monthToDate]);

  const comparedYears = useMemo(
    () =>
      selectedMonth === null
        ? []
        : historyYears(series, selectedMonth.y, selectedMonth.m),
    [series, selectedMonth],
  );

  const theChance = useMemo(
    () =>
      selectedMonth === null
        ? null
        : chance(series, selectedMonth.m, selectedMonth.y),
    [series, selectedMonth],
  );

  const comparison = useMemo(() => {
    const totals = data.window;
    if (totals === null) return null;
    const current =
      totals.years.find((year) => year.year === totals.currentYear) ?? {
        year: totals.currentYear,
        hot: null,
        frp: null,
        estimated: false,
      };
    const past = totals.years.filter((year) => year.year !== totals.currentYear);
    return rankWindow(totals.days, totals.end, current, past);
  }, [data.window]);

  const place =
    selection.kind === "country"
      ? countryName
      : selection.kind === "point"
        ? `${selection.lat.toFixed(3)}, ${selection.lon.toFixed(3)}`
        : t("drawnArea");
  const dates = `${monthYearShort(from.y, from.m, locale)} - ${monthYearShort(to.y, to.m, locale)}`;
  const unitShortKey = mode === "hot" ? "hot" : "cd";
  const scope = scopeOf(selection);
  const largeArea = isLargeArea(selection);

  const hotspots = useMemo(() => {
    const year = (selectedMonth ?? last).y;
    return {
      year,
      link: hotspotsLink({
        selection,
        year,
        lastDay: data.meta.last_data_day,
        countryBox: data.countryBox,
        countryLon: data.countryLon,
      }),
    };
  }, [
    selection,
    selectedMonth,
    last,
    data.meta.last_data_day,
    data.countryBox,
    data.countryLon,
  ]);

  function downloadMonthly() {
    const header = csvHeader({
      selection,
      meta: data.meta,
      from,
      to,
      title: "Emerge: monthly fire numbers",
    });
    saveText(
      monthlyFile(series, header),
      csvFilename(["emerge", "monthly", series.unit, place]),
    );
  }

  function downloadSummary() {
    if (selectedMonth === null || theChance === null) return;
    // The card can be absent (a part month, or a month with no measurement at
    // all); the file still carries the comparison the rule gives for it.
    const figure =
      theUnusual ?? unusual(series, selectedMonth.y, selectedMonth.m);
    const header = csvHeader({
      selection,
      meta: data.meta,
      from,
      to,
      title: "Emerge: summary of the fire record",
      notices: [
        `Selected month: ${selectedMonth === null ? "none" : `${selectedMonth.y}-${String(selectedMonth.m).padStart(2, "0")}`}`,
      ],
    });
    saveText(
      summaryFile(
        { extremes: theExtremes, trend: theTrend, unusual: figure, chance: theChance },
        header,
      ),
      csvFilename(["emerge", "summary", place]),
    );
  }

  const empty = noFireEver(full);

  return (
    <>
      <UnitToggle
        value={mode}
        onChange={(next: UnitMode) => onView({ ...view, unit: next })}
        disabled={selection.kind === "country" ? [] : ["sat"]}
      />

      <p className={styles.monthLine} data-testid="data-line">
        {t("dataLine", {
          date: formatIsoDate(provenance(data.meta).date, locale),
          sensors: provenance(data.meta).sensors,
          model: provenance(data.meta).model,
        })}
      </p>

      {series.lowConfidence ? (
        <p className={styles.notice} data-testid="low-confidence">
          {t("lowConfidence")}
        </p>
      ) : null}

      {data.backgroundMissing ? (
        <p className={styles.notice} data-testid="background-missing">
          {t("backgroundMissing")}
        </p>
      ) : null}

      {empty ? (
        <p className={styles.empty} data-testid="no-fires">
          {t("noFires", { month: monthYearLong(first.y, first.m, locale) })}
        </p>
      ) : null}

      {mode === "sat" ? (
        data.satellites === null ? (
          <p className={styles.state} data-testid="satellite-country-only">
            {t("satelliteCountryOnly")}
          </p>
        ) : (
          <SatelliteTable
            months={clipByMonth(data.satellites, from, to)}
            locale={locale}
            newestFirst
          />
        )
      ) : (
        <FireCalendar
          series={series}
          locale={locale}
          mode={mode}
          anomaly={anomaly}
          yearTotals={yearTotals}
          selected={selectedMonth}
          onSelect={(month: MonthKey) => onView({ ...view, month })}
          svgRef={calendarRef}
        />
      )}

      <p className={styles.monthLine}>
        <span className={styles.monthNow}>
          {t("selectedMonth", {
            month:
              selectedMonth === null
                ? "-"
                : partMonth
                  ? t("partMonth", {
                      day: daysHeld,
                      month: monthYearLong(selectedMonth.y, selectedMonth.m, locale),
                    })
                  : monthYearLong(selectedMonth.y, selectedMonth.m, locale),
          })}
        </span>
        <span>{t("selectMonthHint")}</span>
      </p>

      <DateRange
        months={months}
        from={from}
        to={to}
        locale={locale}
        onChange={(nextFrom, nextTo) =>
          onView({ ...view, from: nextFrom, to: nextTo })
        }
        onReset={() => onView({ ...view, from: null, to: null })}
      />

      <ExtremesSummary
        extremes={theExtremes}
        trend={theTrend}
        locale={locale}
        unitShortKey={unitShortKey}
      />

      <div className={reportStyles.cards}>
        {theUnusual !== null && selectedMonth !== null ? (
          <UnusualCard
            unusual={theUnusual}
            year={selectedMonth.y}
            month={selectedMonth.m}
            locale={locale}
            monthToDate={monthToDate}
          />
        ) : null}
        {theUnusual !== null &&
        selectedMonth !== null &&
        theUnusual.years > 0 &&
        comparedYears.length > 0 ? (
          <p className={styles.notice} data-testid="compared-years">
            {t("comparedWith", {
              month: monthLong(selectedMonth.m, locale),
              first: comparedYears[0],
              last: comparedYears[comparedYears.length - 1],
              years: theUnusual.years,
            })}
          </p>
        ) : null}
        {theUnusual === null && selectedMonth !== null ? (
          <section className={reportStyles.card} data-testid="month-note">
            <h2 className={reportStyles.heading}>
              {partMonth ? t("soFarHeading") : t("noMeasurementHeading")}
            </h2>
            <p className={reportStyles.sub}>
              {partMonth
                ? t("partMonth", {
                    day: daysHeld,
                    month: monthYearLong(selectedMonth.y, selectedMonth.m, locale),
                  })
                : monthYearLong(selectedMonth.y, selectedMonth.m, locale)}
            </p>
            {partMonth && selectedPoint?.value != null ? (
              <p className={reportStyles.cardFigure}>
                {formatCount(selectedPoint.value, locale)}
              </p>
            ) : null}
            <p className={reportStyles.cardLine}>
              {!partMonth
                ? t("noMeasurement")
                : selection.kind === "country"
                  ? t("soFarCountry", { day: daysHeld })
                  : t("soFarNoDays", { day: daysHeld })}
            </p>
          </section>
        ) : null}
        {theChance !== null && selectedMonth !== null ? (
          <ChanceCard
            chance={theChance}
            month={selectedMonth.m}
            locale={locale}
            largeArea={largeArea}
            expectedFireDays={
              largeArea ? typicalFireDays(fireDaysInRange, selectedMonth) : undefined
            }
          />
        ) : null}
      </div>

      {theChance === null ? null : (
        <p className={styles.notice} data-testid="chance-meaning">
          {t("chanceMeaning")}
        </p>
      )}

      {selection.kind === "country" ? (
        <CountryTest iso3={selection.iso3} locale={locale} />
      ) : null}

      {comparison !== null ? (
        <WindowCard comparison={comparison} locale={locale} />
      ) : null}

      <CumulativeChart series={series} year={(selectedMonth ?? last).y} lastDataDay={data.meta.last_data_day} locale={locale} place={place} />
      <TrendChart
        years={yearTotals}
        trend={theTrend}
        locale={locale}
        unitShortKey={unitShortKey}
        svgRef={chartRef}
      />

      <ReportedCard
        reported={data.reported}
        satelliteYears={yearTotals}
        scope={scope}
        locale={locale}
        unitShortKey={unitShortKey}
      />

      <OutsideLinks
        selection={selection}
        countryIso3={
          selection.kind === "country" ? selection.iso3 : (data.reported?.iso3 ?? null)
        }
        countryBox={data.countryBox}
        year={Number(data.meta.last_data_day.slice(0, 4))}
      />

      {mode === "sat" || data.satellites === null ? null : (
        <SatelliteTable
          months={clipByMonth(data.satellites, from, to)}
          locale={locale}
          newestFirst
        />
      )}

      <DataTable series={series} locale={locale} newestFirst />

      <DownloadsMenu
        onMonthlyCsv={downloadMonthly}
        onSummaryCsv={downloadSummary}
        onHotspotsCsv={() => {
          if (hotspots.link !== null) window.open(hotspots.link.href, "_blank");
        }}
        hotspotsHref={hotspots.link?.href}
        hotspotsLabel={t("hotspotsLink", { year: hotspots.year })}
        legendMode={mode}
        calendarRef={calendarRef}
        chartRef={chartRef}
        place={place}
        dates={dates}
      />

      <div className={styles.hotspots}>
        <p className={styles.notice} data-testid="hotspots-note">
          {t("hotspotsNote", {
            year: hotspots.year,
            rows: formatCount(MAX_ROWS, locale),
          })}
          {hotspots.link?.partial === true ? ` ${t("hotspotsPartial")}` : ""}
        </p>
        <p className="rp-sub">{t("hotspotsSlow")}</p>
        <p className="rp-sub">
          {t("dataDate", { date: formatIsoDate(data.meta.last_data_day, locale) })}
        </p>
      </div>

      <Glossary />
    </>
  );
}

function inRecord(months: MonthKey[], month: MonthKey): boolean {
  const rank = monthRank(month);
  const firstRank = months.length === 0 ? rank : monthRank(months[0]);
  const lastRank =
    months.length === 0 ? rank : monthRank(months[months.length - 1]);
  return rank >= firstRank && rank <= lastRank;
}

