/**
 * The tables of the "How we know it is right" page.
 *
 * Every number printed here is read off the validation file and written out as
 * it stands, with no rounding and no formatting that could change it: a
 * technical check is worth nothing if the page quietly reshapes its figures.
 * The words come in through `t`, so this file can be rendered in a test with
 * no React tree around it.
 */

import type {
  AgreementResult,
  ControlTotal,
  HoldoutResult,
  PublishedRatio,
  RangeCoverage,
  SliceResult,
  ValidationFile,
} from "../../types/data";

export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface ProofTablesProps {
  validation: ValidationFile;
  t: Translate;
}

/** A number exactly as the file holds it, or the "not measured yet" words. */
function figure(value: number | null | undefined, t: Translate): string {
  return value === null || value === undefined ? t("empty") : String(value);
}

function years(
  span: [number, number] | null | undefined,
  t: Translate,
): string {
  if (span === null || span === undefined) return t("empty");
  return t("yearSpan", { first: span[0], last: span[1] });
}

function unitWord(unit: "hot" | "cd", t: Translate): string {
  return unit === "hot" ? t("unitHot") : t("unitCd");
}

function scopeWord(scope: string, t: Translate): string {
  if (scope === "country_month") return t("scopeCountryMonth");
  if (scope === "cell_month") return t("scopeCellMonth");
  if (scope === "circle_month") return t("scopeCircleMonth");
  return scope;
}

function flag(passed: boolean | null, t: Translate): string {
  if (passed === null) return t("controls.notRun");
  return passed ? t("controls.passed") : t("controls.failed");
}

function Method({ validation, t }: ProofTablesProps) {
  const method = validation.method;
  const rows: [string, string][] = [
    [t("method.gridDeg"), String(method.grid_deg)],
    [t("method.timeStep"), method.time_step],
    [t("method.model"), method.model ?? t("empty")],
    [t("method.reference"), method.reference],
    [t("method.trainYears"), years(method.train_years, t)],
    [t("method.testYears"), years(method.test_years, t)],
    [
      t("method.preRegistered"),
      method.pre_registered === null ? t("empty") : flag(method.pre_registered, t),
    ],
    [t("method.leakageCheck"), method.leakage_check ?? t("empty")],
  ];

  return (
    <section>
      <h2>{t("method.heading")}</h2>
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Holdout({ rows, t }: { rows: HoldoutResult[]; t: Translate }) {
  return (
    <section>
      <h2>{t("holdout.heading")}</h2>
      <p>{t("holdout.caption")}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">{t("holdout.direction")}</th>
            <th scope="col">{t("holdout.unit")}</th>
            <th scope="col">{t("holdout.scope")}</th>
            <th scope="col">{t("holdout.n")}</th>
            <th scope="col">{t("holdout.nrmse")}</th>
            <th scope="col">{t("holdout.mae")}</th>
            <th scope="col">{t("holdout.bias")}</th>
            <th scope="col">{t("holdout.r")}</th>
            <th scope="col">{t("holdout.slope")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, at) => (
            <tr key={`${row.direction}-${row.unit}-${row.scope}-${at}`}>
              <td>{t(`holdout.${row.direction}`)}</td>
              <td>{unitWord(row.unit, t)}</td>
              <td>{scopeWord(row.scope, t)}</td>
              <td className="num">{figure(row.n, t)}</td>
              <td className="num">{figure(row.nrmse, t)}</td>
              <td className="num">{figure(row.mae, t)}</td>
              <td className="num">{figure(row.bias_pct, t)}</td>
              <td className="num">{figure(row.r, t)}</td>
              <td className="num">{figure(row.slope, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Slices({ rows, t }: { rows: SliceResult[]; t: Translate }) {
  return (
    <section>
      <h2>{t("slices.heading")}</h2>
      <p>{t("slices.caption")}</p>
      {rows.length === 0 ? (
        <p>{t("slices.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("slices.slice")}</th>
              <th scope="col">{t("slices.key")}</th>
              <th scope="col">{t("slices.unit")}</th>
              <th scope="col">{t("slices.n")}</th>
              <th scope="col">{t("slices.nrmse")}</th>
              <th scope="col">{t("slices.bias")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.slice}-${row.key}-${row.unit}-${at}`}>
                <td>{row.slice}</td>
                <td>{row.key}</td>
                <td>{unitWord(row.unit, t)}</td>
                <td className="num">{figure(row.n, t)}</td>
                <td className="num">{figure(row.nrmse, t)}</td>
                <td className="num">{figure(row.bias_pct, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Agreement({ rows, t }: { rows: AgreementResult[]; t: Translate }) {
  return (
    <section>
      <h2>{t("agreement.heading")}</h2>
      <p>{t("agreement.caption")}</p>
      {rows.length === 0 ? (
        <p>{t("agreement.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("agreement.pair")}</th>
              <th scope="col">{t("agreement.unit")}</th>
              <th scope="col">{t("agreement.years")}</th>
              <th scope="col">{t("agreement.n")}</th>
              <th scope="col">{t("agreement.diff")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.pair}-${row.unit}-${at}`}>
                <td>{row.pair}</td>
                <td>{unitWord(row.unit, t)}</td>
                <td>{years(row.years, t)}</td>
                <td className="num">{figure(row.n, t)}</td>
                <td className="num">{figure(row.diff_pct, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Ratios({ rows, t }: { rows: PublishedRatio[]; t: Translate }) {
  return (
    <section>
      <h2>{t("ratios.heading")}</h2>
      <p>{t("ratios.caption")}</p>
      {rows.length === 0 ? (
        <p>{t("ratios.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("ratios.scope")}</th>
              <th scope="col">{t("ratios.unit")}</th>
              <th scope="col">{t("ratios.ours")}</th>
              <th scope="col">{t("ratios.published")}</th>
              <th scope="col">{t("ratios.source")}</th>
              <th scope="col">{t("ratios.note")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.scope}-${row.unit}-${at}`}>
                <td>{row.scope}</td>
                <td>{unitWord(row.unit, t)}</td>
                <td className="num">{figure(row.ours, t)}</td>
                <td className="num">{figure(row.published, t)}</td>
                <td>{row.published_source ?? t("empty")}</td>
                <td>{row.note ?? t("empty")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Coverage({ rows, t }: { rows: RangeCoverage[]; t: Translate }) {
  return (
    <section>
      <h2>{t("coverage.heading")}</h2>
      <p>{t("coverage.caption")}</p>
      {rows.length === 0 ? (
        <p>{t("coverage.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("coverage.level")}</th>
              <th scope="col">{t("coverage.unit")}</th>
              <th scope="col">{t("coverage.scope")}</th>
              <th scope="col">{t("coverage.n")}</th>
              <th scope="col">{t("coverage.observed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.level_pct}-${row.unit}-${row.scope}-${at}`}>
                <td className="num">{String(row.level_pct)}</td>
                <td>{unitWord(row.unit, t)}</td>
                <td>{scopeWord(row.scope, t)}</td>
                <td className="num">{figure(row.n, t)}</td>
                <td className="num">{figure(row.observed_pct, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ChanceCheck({ validation, t }: ProofTablesProps) {
  const bins = validation.chance_of_fire.reliability;
  return (
    <section>
      <h2>{t("chance.heading")}</h2>
      <p>
        {t("chance.brier")}: <span className="num">{figure(validation.chance_of_fire.brier, t)}</span>
      </p>
      <p>{t("chance.caption")}</p>
      {bins.length === 0 ? (
        <p>{t("chance.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("chance.bin")}</th>
              <th scope="col">{t("chance.predicted")}</th>
              <th scope="col">{t("chance.observed")}</th>
              <th scope="col">{t("chance.n")}</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((bin, at) => (
              <tr key={`${bin.bin[0]}-${bin.bin[1]}-${at}`}>
                <td className="num">
                  {t("chance.binRange", { low: bin.bin[0], high: bin.bin[1] })}
                </td>
                <td className="num">{figure(bin.predicted, t)}</td>
                <td className="num">{figure(bin.observed, t)}</td>
                <td className="num">{figure(bin.n, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Controls({ rows, t }: { rows: ControlTotal[]; t: Translate }) {
  return (
    <section>
      <h2>{t("controls.heading")}</h2>
      <p>{t("controls.caption")}</p>
      {rows.length === 0 ? (
        <p>{t("controls.none")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("controls.check")}</th>
              <th scope="col">{t("controls.result")}</th>
              <th scope="col">{t("controls.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.check}-${at}`}>
                <td>{row.check}</td>
                <td>{flag(row.passed, t)}</td>
                <td>{row.detail ?? t("empty")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function ProofTables({ validation, t }: ProofTablesProps) {
  return (
    <>
      <Method validation={validation} t={t} />
      <Holdout rows={validation.holdout} t={t} />
      <Coverage rows={validation.range_coverage} t={t} />
      <Agreement rows={validation.satellite_agreement} t={t} />
      <Ratios rows={validation.published_ratios} t={t} />
      <ChanceCheck validation={validation} t={t} />
      <Slices rows={validation.slices} t={t} />
      <Controls rows={validation.control_totals} t={t} />
      <section>
        <h2>{t("limits.heading")}</h2>
        {validation.limits.length === 0 ? (
          <p>{t("limits.none")}</p>
        ) : (
          <ul>
            {validation.limits.map((limit) => (
              <li key={limit.id}>{limit.text}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
