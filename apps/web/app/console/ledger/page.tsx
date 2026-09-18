"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, StatTile, Mono, VerdictChip } from "../../../components/console/ui";
import { Empty } from "../../../components/console/empty";
import { get } from "../../../components/console/api";
import { ASSET } from "../../../components/console/network";

/**
 * B8 `/console/ledger`.
 *
 * **§10.2 is the whole page: reserved authority and settled spend are two different facts and are
 * never summed.** A decision reserves budget; it does not move money. Most dashboards would add
 * these into one "spent" figure, which is precisely the claim Ambit refuses to make — the money is
 * still in the wallet, and the reservation may lapse unspent.
 *
 * The reservation lifecycle is shown per row: HELD while executable, SETTLED once money moved,
 * RELEASED when a decision was refused at execution or its window closed.
 */

type Entry = {
  id: string;
  createdAt: string;
  capability: string;
  amount: string;
  asset: string;
  recipient: string;
  verdict: "ALLOW" | "ESCALATE" | "BLOCK";
  reasonCode: string | null;
  execution: string;
  reservationState: "HELD" | "SETTLED" | "RELEASED" | null;
  amountAtomic: string | null;
  expiresAt: string | null;
};

type Ledger = {
  asOf: string;
  settledTodayAtomic: string;
  reservedTodayAtomic: string;
  entries: Entry[];
};

const usdc = (atomic: string): string => (Number(atomic) / 1e6).toFixed(6);

function ReservationMark({ state }: { state: Entry["reservationState"] }) {
  if (state === "SETTLED") return <span className="tag inside">settled</span>;
  if (state === "HELD") return <span className="tag caution">held</span>;
  if (state === "RELEASED") return <span className="tag never">released</span>;
  return <span className="note">—</span>;
}

export default function LedgerPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const r = await get<Ledger>("/ledger");
    if (r.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (r.state === "ok") setLedger(r.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (unreachable) {
    return (
      <>
        <SectionTitle kicker="Ledger" title="Reserved and settled" />
        <Empty state="UNREACHABLE" detail="Start it with: pnpm dev:authority" />
      </>
    );
  }

  const settled = ledger ? Number(ledger.settledTodayAtomic) : null;
  const reserved = ledger ? Number(ledger.reservedTodayAtomic) : null;

  return (
    <>
      <SectionTitle
        kicker="Ledger"
        title="Reserved and settled"
        aside={ledger ? <span className="bytes dim">as of {ledger.asOf}</span> : null}
      />

      <p className="lead" style={{ maxWidth: "58ch", marginBottom: "1.5rem" }}>
        These are two different facts and this page never adds them together. A decision{" "}
        <strong>reserves</strong> budget; it does not move money.
      </p>

      <section className="tiles">
        <StatTile
          label="Settled today"
          value={settled === null ? null : usdc(String(settled))}
          detail={`${ASSET} that actually left the wallet`}
        />
        <StatTile
          label="Reserved today"
          value={reserved === null ? null : usdc(String(reserved))}
          emphasis="boundary"
          detail="still-executable authority, not spend"
        />
        <StatTile
          label="Entries"
          value={ledger ? ledger.entries.length : null}
          detail="every decision, allowed or refused"
        />
      </section>

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="note" style={{ margin: 0, maxWidth: "62ch" }}>
          <strong>Why they are kept apart.</strong> Rule 12 <code>budget.daily</code> enforces against{" "}
          <em>effective</em> usage (settled plus reserved), so ten pending approvals cannot jointly
          exceed a budget that fits one. But a reservation is not a purchase: it can lapse unspent, and
          reporting it as spend would tell you money left when it did not. The two totals come from
          separate accessors so that no query can accidentally sum them.
        </p>
      </div>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>Entries</h3>
        {ledger === null ? (
          <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "30rem", marginTop: "1rem" }}>
            <span className="sr-only">Reading the ledger.</span>
            <div className="pending-bar" style={{ width: "70%" }} />
            <div className="pending-bar" style={{ width: "46%" }} />
          </div>
        ) : ledger.entries.length === 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <Empty state="NO_DATA" />
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Capability</th>
                  <th>Amount</th>
                  <th>Verdict</th>
                  <th>Reservation</th>
                  <th>Execution</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="bytes dim">{e.createdAt.slice(11, 19)}</td>
                    <td>{e.capability}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
                      {e.amount} {e.asset}
                    </td>
                    <td><VerdictChip verdict={e.verdict} /></td>
                    <td><ReservationMark state={e.reservationState} /></td>
                    <td className="note">
                      {e.execution === "SETTLED" ? (
                        <span className="tag inside">settled</span>
                      ) : e.execution === "REFUSED" ? (
                        <span className="tag never">refused</span>
                      ) : (
                        <Mono>{e.execution.toLowerCase()}</Mono>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="note" style={{ marginTop: "1rem", maxWidth: "58ch" }}>
          A refused decision reserves nothing, so its reservation column is a dash rather than a zero.
          A zero would be a measurement; there is nothing to measure.
        </p>
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>What this ledger is not</h3>
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Durable</dt>
          <dd>
            Storage is in-memory in this phase. Restarting the service empties it, and the ledger shows
            this session, not an account history.
          </dd>
          <dt>Double-entry</dt>
          <dd>
            It records decisions and their reservations, not a full accounting model. Fees, refunds
            and reversals are not represented because none are implemented.
          </dd>
        </dl>
      </section>
    </>
  );
}
