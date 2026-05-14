import type {
  CustomerRow,
  DashboardData,
  LineItemRow,
  ManagerPkgDetail,
  ManagerStrengthEntry,
  PeriodBlock,
  PeriodLocData,
  TxRow,
} from "./schema";
import { PREMIUM_PACKAGES, STONE_ITEMS, UP5, UPSELL_ITEMS } from "./schema";

type Loc = string;
type Period = string;

const ZEROS = (n: number) => new Array(n).fill(0);

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function weekKey(d: Date): string {
  // ISO week 기반
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function uniqSorted<T>(arr: Iterable<T>): T[] {
  return Array.from(new Set(arr)).sort();
}

function truthy(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "y" || s === "yes" || s === "예";
}

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

interface ParseInput {
  transactions: TxRow[];
  lineItems: LineItemRow[];
  customers?: CustomerRow[];
}

export function transformToDashboardData(input: ParseInput): DashboardData {
  const { transactions, lineItems, customers = [] } = input;

  // 거래 → 정규화
  type Tx = {
    id: string;
    date: Date;
    month: Period;
    week: Period;
    loc: Loc;
    manager: string | null;
    package: string | null;
    amt_funeral: number;
    amt_addon: number;
    amt_weight: number;
    discount: number;
    isFuneral: boolean; // 추모전용 아님
  };

  const txMap = new Map<string, Tx>();
  for (const r of transactions) {
    const d = toDate(r.날짜);
    if (!d || !r.거래ID) continue;
    txMap.set(String(r.거래ID), {
      id: String(r.거래ID),
      date: d,
      month: monthKey(d),
      week: weekKey(d),
      loc: r.지점 || "미상",
      manager: r.지도사 || null,
      package: r.패키지 || null,
      amt_funeral: num(r.장례매출),
      amt_addon: num(r.부가매출),
      amt_weight: num(r.무게추가),
      discount: num(r.할인금액),
      isFuneral: !truthy(r.추모전용) && !!r.패키지,
    });
  }

  // 라인아이템 → 거래별 집계
  type LineSummary = {
    items: LineItemRow[];
    has_upsell5: boolean; // UP5 중 가격>기본가 하나라도
    upsell5_items: Set<string>; // 어떤 UP5가 업셀링됐는지
    has_stone: boolean; // 스톤제작/스톤함 하나라도
    stone_jejak_cnt: number; // 스톤제작 라인 수
    stone_ham_cnt: number;
    charnel_new_cnt: number;
    charnel_ext_cnt: number;
    stone_amt: number;
    charnel_amt: number;
    upsell_amt_by_item: Record<string, number>; // UP5 차액 합
    addon_stone_amt: number;
    addon_burial_amt: number;
    addon_etc_amt: number;
  };
  const lineMap = new Map<string, LineSummary>();
  function getLine(id: string): LineSummary {
    let l = lineMap.get(id);
    if (!l) {
      l = {
        items: [],
        has_upsell5: false,
        upsell5_items: new Set(),
        has_stone: false,
        stone_jejak_cnt: 0,
        stone_ham_cnt: 0,
        charnel_new_cnt: 0,
        charnel_ext_cnt: 0,
        stone_amt: 0,
        charnel_amt: 0,
        upsell_amt_by_item: {},
        addon_stone_amt: 0,
        addon_burial_amt: 0,
        addon_etc_amt: 0,
      };
      lineMap.set(id, l);
    }
    return l;
  }

  for (const li of lineItems) {
    if (!li.거래ID) continue;
    const id = String(li.거래ID);
    const l = getLine(id);
    l.items.push(li);
    const price = num(li.가격);
    const base = num(li.기본가);
    const item = li.품목 || "";
    const cat = li.카테고리 || "";

    if (UP5.includes(item)) {
      if (price > base) {
        l.has_upsell5 = true;
        l.upsell5_items.add(item);
        l.upsell_amt_by_item[item] = (l.upsell_amt_by_item[item] || 0) + (price - base);
      }
    }
    if (item === "스톤제작") {
      l.stone_jejak_cnt += 1;
      l.has_stone = true;
      l.stone_amt += price;
      l.addon_stone_amt += price;
    } else if (item === "스톤함") {
      l.stone_ham_cnt += 1;
      l.has_stone = true;
      l.stone_amt += price;
      l.addon_stone_amt += price;
    } else if (item === "봉안당신규") {
      l.charnel_new_cnt += 1;
      l.charnel_amt += price;
      l.addon_burial_amt += price;
    } else if (item === "봉안당연장") {
      l.charnel_ext_cnt += 1;
      l.charnel_amt += price;
      l.addon_burial_amt += price;
    } else if (cat === "봉안" || cat === "추모봉안") {
      l.addon_burial_amt += price;
    } else if (cat === "스톤" || cat === "추모스톤") {
      l.addon_stone_amt += price;
    } else if (cat === "기타" || cat === "기타부가") {
      l.addon_etc_amt += price;
    }
  }

  // 모든 거래 / 라인 결합한 정규 entries
  const txEntries = Array.from(txMap.values()).map((t) => ({
    tx: t,
    line: lineMap.get(t.id) || getLine(t.id),
  }));

  if (txEntries.length === 0) {
    throw new Error("거래 데이터가 비어있습니다. Transactions 시트를 확인하세요.");
  }

  // periods 추출
  const months = uniqSorted(txEntries.map((e) => e.tx.month));
  const weeks = uniqSorted(txEntries.map((e) => e.tx.week));
  const locations = ["전체", ...uniqSorted(txEntries.map((e) => e.tx.loc))];
  const packageList = uniqSorted(
    txEntries.filter((e) => e.tx.package).map((e) => e.tx.package as string),
  );
  const upsellItems = UPSELL_ITEMS.filter((it) =>
    lineItems.some((li) => li.품목 === it),
  );
  const memorialBurialItems = uniqSorted(
    lineItems
      .filter((li) => li.품목 === "봉안당신규" || li.품목 === "봉안당연장")
      .map((li) => li.품목),
  );
  const etcAddItemsSet = new Set<string>();
  for (const li of lineItems) {
    if ((li.카테고리 === "기타" || li.카테고리 === "기타부가") && li.품목) {
      etcAddItemsSet.add(li.품목);
    }
  }
  const etcAddItems = Array.from(etcAddItemsSet).sort();

  // === Monthly aggregation ===
  function buildPeriodBlock(periods: Period[], keyFn: (e: typeof txEntries[number]) => Period): PeriodBlock {
    const locs = locations;
    const block: PeriodBlock = {
      periods,
      by_location: {},
    };
    const idx = new Map<Period, number>();
    periods.forEach((p, i) => idx.set(p, i));

    for (const loc of locs) {
      const empty: PeriodLocData = {
        amt_total: ZEROS(periods.length),
        amt_장례: ZEROS(periods.length),
        amt_부가: ZEROS(periods.length),
        amt_무게추가: ZEROS(periods.length),
        amt_부가_스톤: ZEROS(periods.length),
        amt_부가_봉안: ZEROS(periods.length),
        amt_부가_etc: ZEROS(periods.length),
        ["할인금액"]: ZEROS(periods.length),
        tx_count: ZEROS(periods.length),
        funeral_tx_count: ZEROS(periods.length),
        cnt_funeral: ZEROS(periods.length),
        package_amt: Object.fromEntries(packageList.map((p) => [p, ZEROS(periods.length)])),
        package_cnt: Object.fromEntries(packageList.map((p) => [p, ZEROS(periods.length)])),
        pkg_amt_total: ZEROS(periods.length),
        pkg_with_upsell_count: Object.fromEntries(packageList.map((p) => [p, ZEROS(periods.length)])),
        pkg_basic_only_count: Object.fromEntries(packageList.map((p) => [p, ZEROS(periods.length)])),
        pkg_stone_count: Object.fromEntries(packageList.map((p) => [p, ZEROS(periods.length)])),
        pkg_x_item_count: Object.fromEntries(
          packageList.map((p) => [
            p,
            Object.fromEntries(upsellItems.map((it) => [it, ZEROS(periods.length)])),
          ]),
        ),
        upsell_amt: Object.fromEntries(upsellItems.map((it) => [it, ZEROS(periods.length)])),
        upsell_cnt: Object.fromEntries(upsellItems.map((it) => [it, ZEROS(periods.length)])),
        upsell_attach: Object.fromEntries(upsellItems.map((it) => [it, ZEROS(periods.length)])),
        memorial_stone: Object.fromEntries(
          ["스톤제작", "스톤함"].map((it) => [it, { amt: ZEROS(periods.length), cnt: ZEROS(periods.length) }]),
        ),
        memorial_burial: Object.fromEntries(
          memorialBurialItems.map((it) => [it, { amt: ZEROS(periods.length), cnt: ZEROS(periods.length) }]),
        ),
        etc_add: Object.fromEntries(
          etcAddItems.map((it) => [it, { amt: ZEROS(periods.length), cnt: ZEROS(periods.length) }]),
        ),
      };
      block.by_location[loc] = empty;
    }

    for (const e of txEntries) {
      const p = keyFn(e);
      const i = idx.get(p);
      if (i == null) continue;
      const targets: PeriodLocData[] = [block.by_location["전체"], block.by_location[e.tx.loc]];
      for (const t of targets) {
        if (!t) continue;
        t.tx_count[i] += 1;
        t.amt_total[i] += e.tx.amt_funeral + e.tx.amt_addon + e.tx.amt_weight;
        t.amt_장례[i] += e.tx.amt_funeral;
        t.amt_부가[i] += e.tx.amt_addon;
        t.amt_무게추가[i] += e.tx.amt_weight;
        t["할인금액"][i] += e.tx.discount;
        t.amt_부가_스톤[i] += e.line.addon_stone_amt;
        t.amt_부가_봉안[i] += e.line.addon_burial_amt;
        t.amt_부가_etc[i] += e.line.addon_etc_amt;
        if (e.tx.isFuneral) {
          t.funeral_tx_count[i] += 1;
          t.cnt_funeral[i] += 1;
        }
        if (e.tx.package && t.package_amt[e.tx.package]) {
          t.package_amt[e.tx.package][i] += e.tx.amt_funeral;
          t.package_cnt[e.tx.package][i] += 1;
          t.pkg_amt_total[i] += e.tx.amt_funeral;
          const anyUpsell = e.line.has_upsell5 || e.line.has_stone;
          if (anyUpsell) t.pkg_with_upsell_count[e.tx.package][i] += 1;
          else t.pkg_basic_only_count[e.tx.package][i] += 1;
          if (e.line.has_stone) t.pkg_stone_count[e.tx.package][i] += 1;
          for (const it of upsellItems) {
            const hit =
              (UP5.includes(it) && e.line.upsell5_items.has(it)) ||
              (it === "스톤제작" && e.line.stone_jejak_cnt > 0) ||
              (it === "스톤함" && e.line.stone_ham_cnt > 0);
            if (hit) t.pkg_x_item_count[e.tx.package][it][i] += 1;
          }
        }
        for (const it of upsellItems) {
          if (UP5.includes(it)) {
            const v = e.line.upsell_amt_by_item[it];
            if (v && v > 0) {
              t.upsell_amt[it][i] += v;
              t.upsell_cnt[it][i] += 1;
            }
          } else if (it === "스톤제작") {
            if (e.line.stone_jejak_cnt > 0) {
              t.upsell_cnt[it][i] += 1;
              t.upsell_amt[it][i] += e.line.addon_stone_amt; // 근사
            }
          } else if (it === "스톤함") {
            if (e.line.stone_ham_cnt > 0) {
              t.upsell_cnt[it][i] += 1;
            }
          }
        }
        // 부가 세부 (라인아이템 단위 집계는 거래단위 누락 가능 → 별도 라인 루프에서)
      }
    }

    // 부가 세부 (라인아이템 직접 루프)
    for (const li of lineItems) {
      const tx = txMap.get(String(li.거래ID));
      if (!tx) continue;
      const p = keyFn({ tx, line: getLine(tx.id) });
      const i = idx.get(p);
      if (i == null) continue;
      const targets: PeriodLocData[] = [block.by_location["전체"], block.by_location[tx.loc]];
      const item = li.품목 || "";
      const price = num(li.가격);
      for (const t of targets) {
        if (!t) continue;
        if (item === "스톤제작" || item === "스톤함") {
          t.memorial_stone[item].amt[i] += price;
          t.memorial_stone[item].cnt[i] += 1;
        } else if (memorialBurialItems.includes(item)) {
          t.memorial_burial[item].amt[i] += price;
          t.memorial_burial[item].cnt[i] += 1;
        } else if (li.카테고리 === "기타" || li.카테고리 === "기타부가") {
          if (t.etc_add[item]) {
            t.etc_add[item].amt[i] += price;
            t.etc_add[item].cnt[i] += 1;
          }
        }
      }
    }

    // upsell_attach: 월별 발생률 = 발생거래 / 장례거래
    for (const loc of locations) {
      const d = block.by_location[loc];
      for (const it of upsellItems) {
        for (let i = 0; i < periods.length; i++) {
          const fc = d.funeral_tx_count[i];
          d.upsell_attach[it][i] = fc > 0 ? (d.upsell_cnt[it][i] / fc) * 100 : 0;
        }
      }
    }

    return block;
  }

  const monthly = buildPeriodBlock(months, (e) => e.tx.month);
  const weekly = buildPeriodBlock(weeks, (e) => e.tx.week);

  // === Manager AOV (월별) ===
  const managerAovByLoc: Record<string, Record<string, { tx: number[]; aov: (number | null)[]; amt: number[]; by_pkg_detail: Record<string, ManagerPkgDetail> }>> = {};
  for (const loc of locations) managerAovByLoc[loc] = {};

  for (const e of txEntries) {
    if (!e.tx.manager) continue;
    const i = months.indexOf(e.tx.month);
    if (i < 0) continue;
    for (const loc of [e.tx.loc, "전체"]) {
      let m = managerAovByLoc[loc][e.tx.manager];
      if (!m) {
        m = {
          tx: ZEROS(months.length),
          aov: new Array(months.length).fill(null),
          amt: ZEROS(months.length),
          by_pkg_detail: {},
        };
        managerAovByLoc[loc][e.tx.manager] = m;
      }
      m.tx[i] += 1;
      m.amt[i] += e.tx.amt_funeral + e.tx.amt_addon + e.tx.amt_weight;
      // 패키지별 detail
      if (e.tx.package) {
        let pd = m.by_pkg_detail[e.tx.package];
        if (!pd) {
          pd = {
            tx: ZEROS(months.length),
            upsell_cnt: ZEROS(months.length),
            basic_only_cnt: ZEROS(months.length),
            stone_cnt: ZEROS(months.length),
            by_item: Object.fromEntries(UP5.map((it) => [it, ZEROS(months.length)])),
          };
          m.by_pkg_detail[e.tx.package] = pd;
        }
        pd.tx[i] += 1;
        const anyUpsell = e.line.has_upsell5 || e.line.has_stone;
        if (anyUpsell) pd.upsell_cnt[i] += 1;
        else pd.basic_only_cnt[i] += 1;
        if (e.line.has_stone) pd.stone_cnt[i] += 1;
        for (const it of UP5) {
          if (e.line.upsell5_items.has(it)) pd.by_item[it][i] += 1;
        }
      }
    }
  }

  // aov 채우기
  for (const loc of locations) {
    for (const mg of Object.keys(managerAovByLoc[loc])) {
      const m = managerAovByLoc[loc][mg];
      for (let i = 0; i < months.length; i++) {
        m.aov[i] = m.tx[i] > 0 ? Math.round(m.amt[i] / m.tx[i]) : null;
      }
    }
  }

  const manager_aov: DashboardData["manager_aov"] = {
    periods: months,
    by_location: {},
  };
  for (const loc of locations) {
    const map = managerAovByLoc[loc];
    const managers = Object.keys(map).sort((a, b) => {
      const ta = map[a].tx.reduce((s, v) => s + v, 0);
      const tb = map[b].tx.reduce((s, v) => s + v, 0);
      return tb - ta;
    });
    manager_aov.by_location[loc] = {
      managers,
      data: Object.fromEntries(
        managers.map((mg) => [
          mg,
          {
            tx: map[mg].tx,
            aov: map[mg].aov,
            by_pkg_detail: map[mg].by_pkg_detail,
          },
        ]),
      ),
    };
  }

  // === Manager strength monthly ===
  // 각 (월, 지점) 별로 매니저별 통계
  const manager_strength_monthly: DashboardData["manager_strength_monthly"] = {};
  for (const loc of locations) {
    const by_period: Record<string, { avg: any; managers: ManagerStrengthEntry[] }> = {};
    for (const monthIdx in months) {
      const period = months[monthIdx];
      const i = parseInt(monthIdx);
      const inScope = txEntries.filter((e) => e.tx.month === period && (loc === "전체" || e.tx.loc === loc) && e.tx.manager);
      // 매니저별 그룹화
      const byMgr = new Map<string, typeof inScope>();
      for (const e of inScope) {
        const k = e.tx.manager as string;
        if (!byMgr.has(k)) byMgr.set(k, []);
        byMgr.get(k)!.push(e);
      }
      const managers: ManagerStrengthEntry[] = [];
      let totalTxAll = 0;
      let totalAmtAll = 0;
      for (const [name, list] of byMgr) {
        if (list.length < 3) continue;
        const tx = list.length;
        const amt = list.reduce((s, e) => s + e.tx.amt_funeral + e.tx.amt_addon + e.tx.amt_weight, 0);
        const aov = Math.round(amt / tx);
        const premiumCnt = list.filter((e) => e.tx.package && PREMIUM_PACKAGES.has(e.tx.package)).length;
        const upsellCnt = list.filter((e) => e.line.has_upsell5).length;
        const stoneEligible = list.filter((e) => e.tx.package && e.tx.package !== "올인원").length;
        const stoneCnt = list.filter((e) => e.tx.package && e.tx.package !== "올인원" && e.line.has_stone).length;
        const upsellAmtTotal = list.reduce((s, e) => {
          let total = 0;
          for (const v of Object.values(e.line.upsell_amt_by_item)) total += v;
          return s + total;
        }, 0);
        const premium_pct = (premiumCnt / tx) * 100;
        const upsell_pct = (upsellCnt / tx) * 100;
        const stone_pct = stoneEligible > 0 ? (stoneCnt / stoneEligible) * 100 : 0;
        const upsell_amt_per_tx = tx > 0 ? Math.round(upsellAmtTotal / tx) : 0;
        const pkg_dist: Record<string, number> = {};
        for (const e of list) if (e.tx.package) pkg_dist[e.tx.package] = (pkg_dist[e.tx.package] || 0) + 1;
        const loc_dist: Record<string, number> = {};
        for (const e of list) loc_dist[e.tx.loc] = (loc_dist[e.tx.loc] || 0) + 1;
        const primary_loc = Object.entries(loc_dist).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        const stone_jejak_cnt = list.reduce((s, e) => s + e.line.stone_jejak_cnt, 0);
        const stone_ham_cnt = list.reduce((s, e) => s + e.line.stone_ham_cnt, 0);
        const stone_tx = list.filter((e) => e.line.has_stone).length;
        const stone_amt = list.reduce((s, e) => s + e.line.stone_amt, 0);
        const charnel_new_cnt = list.reduce((s, e) => s + e.line.charnel_new_cnt, 0);
        const charnel_ext_cnt = list.reduce((s, e) => s + e.line.charnel_ext_cnt, 0);
        const charnel_total = list.filter((e) => e.line.charnel_new_cnt + e.line.charnel_ext_cnt > 0).length;
        const charnel_amt = list.reduce((s, e) => s + e.line.charnel_amt, 0);
        const stone_item_aov = stone_tx > 0 ? Math.round(stone_amt / stone_tx) : 0;
        const charnel_item_aov = charnel_total > 0 ? Math.round(charnel_amt / charnel_total) : 0;

        // tags
        const tags: ManagerStrengthEntry["tags"] = [];
        if (premium_pct >= 40) tags.push({ name: "고가형", icon: "🎁", gap: premium_pct });
        if (upsell_pct >= 50) tags.push({ name: "업셀러", icon: "💎", gap: upsell_pct });
        if (stone_pct >= 30) tags.push({ name: "스톤강자", icon: "⭐", gap: stone_pct });
        if (tags.length === 0) tags.push({ name: "균형형", icon: "⚖️", gap: 0 });

        managers.push({
          name,
          primary_loc,
          loc_dist,
          tx,
          amt,
          aov,
          premium_pct,
          upsell_pct,
          stone_pct,
          upsell_amt_per_tx,
          pkg_dist,
          tags,
          stone_jejak_cnt,
          stone_ham_cnt,
          stone_total_cnt: stone_tx,
          stone_tx,
          stone_amt,
          stone_item_aov,
          charnel_new_cnt,
          charnel_ext_cnt,
          charnel_total_cnt: charnel_total,
          charnel_amt,
          charnel_item_aov,
        });
        totalTxAll += tx;
        totalAmtAll += amt;
      }
      managers.sort((a, b) => b.aov - a.aov);
      // avg
      const avg = {
        aov: managers.length > 0 ? Math.round(managers.reduce((s, m) => s + m.aov, 0) / managers.length) : 0,
        premium_pct: managers.length > 0 ? managers.reduce((s, m) => s + m.premium_pct, 0) / managers.length : 0,
        upsell_pct: managers.length > 0 ? managers.reduce((s, m) => s + m.upsell_pct, 0) / managers.length : 0,
        stone_pct: managers.length > 0 ? managers.reduce((s, m) => s + m.stone_pct, 0) / managers.length : 0,
        upsell_amt_per_tx:
          managers.length > 0
            ? Math.round(managers.reduce((s, m) => s + m.upsell_amt_per_tx, 0) / managers.length)
            : 0,
        tx: totalTxAll,
      };
      by_period[period] = { avg, managers };
    }
    manager_strength_monthly![loc] = { periods: months, by_period };
  }

  // === Customer profile comparison (지점별, 12개월 누적) ===
  const customer_profile_comparison: DashboardData["customer_profile_comparison"] = {};
  const custMap = new Map<string, CustomerRow>();
  for (const c of customers) custMap.set(String(c.거래ID), c);

  function weightBucket(w: number): string {
    if (w < 3) return "소형(<3kg)";
    if (w < 7) return "중소형(3-7kg)";
    if (w < 15) return "중형(7-15kg)";
    if (w < 30) return "대형(15-30kg)";
    return "특대형(30kg+)";
  }
  function ageBucket(a: number): string {
    if (a < 30) return "20대 이하";
    if (a < 40) return "30대";
    if (a < 50) return "40대";
    if (a < 60) return "50대";
    return "60대+";
  }

  for (const loc of locations) {
    // 12개월 누적 매니저 AOV 계산해서 상위 1/3, 하위 1/3
    const mgrTotals: { name: string; tx: number; amt: number; aov: number }[] = [];
    const inScope = txEntries.filter((e) => (loc === "전체" || e.tx.loc === loc) && e.tx.manager);
    const byMgr = new Map<string, typeof inScope>();
    for (const e of inScope) {
      const k = e.tx.manager as string;
      if (!byMgr.has(k)) byMgr.set(k, []);
      byMgr.get(k)!.push(e);
    }
    for (const [name, list] of byMgr) {
      if (list.length < 5) continue;
      const tx = list.length;
      const amt = list.reduce((s, e) => s + e.tx.amt_funeral + e.tx.amt_addon + e.tx.amt_weight, 0);
      mgrTotals.push({ name, tx, amt, aov: Math.round(amt / tx) });
    }
    if (mgrTotals.length < 6) continue;
    mgrTotals.sort((a, b) => b.aov - a.aov);
    const groupSize = Math.max(1, Math.floor(mgrTotals.length / 3));
    const topGroup = mgrTotals.slice(0, groupSize);
    const botGroup = mgrTotals.slice(-groupSize);

    function profileFor(group: typeof mgrTotals) {
      const names = new Set(group.map((m) => m.name));
      const entries = inScope.filter((e) => names.has(e.tx.manager as string));
      const tx = entries.length;
      const amt = entries.reduce((s, e) => s + e.tx.amt_funeral + e.tx.amt_addon + e.tx.amt_weight, 0);
      const aov_avg = tx > 0 ? Math.round(amt / tx) : 0;
      const death: Record<string, number> = {};
      const weight: Record<string, number> = {};
      const age: Record<string, number> = {};
      const breed: Record<string, number> = {};
      let wAcc = 0, wN = 0;
      let weightUnknown = 0, ageUnknown = 0;
      for (const e of entries) {
        const c = custMap.get(e.tx.id);
        if (!c) continue;
        const dc = c.사망원인 || "미상";
        death[dc] = (death[dc] || 0) + 1;
        const w = num(c.반려동물체중);
        if (w > 0) {
          weight[weightBucket(w)] = (weight[weightBucket(w)] || 0) + 1;
          wAcc += w;
          wN += 1;
        } else weightUnknown += 1;
        const a = num(c.보호자연령);
        if (a > 0) age[ageBucket(a)] = (age[ageBucket(a)] || 0) + 1;
        else ageUnknown += 1;
        const br = c.반려동물품종 || "미상";
        breed[br] = (breed[br] || 0) + 1;
      }
      // %로 변환
      const totalDeath = Object.values(death).reduce((s, v) => s + v, 0) || 1;
      const totalAge = Object.values(age).reduce((s, v) => s + v, 0) + ageUnknown || 1;
      const totalWeight = Object.values(weight).reduce((s, v) => s + v, 0) + weightUnknown || 1;
      const pctDeath = Object.fromEntries(Object.entries(death).map(([k, v]) => [k, (v / totalDeath) * 100]));
      const pctWeight = Object.fromEntries(Object.entries(weight).map(([k, v]) => [k, (v / totalWeight) * 100]));
      pctWeight["미상"] = (weightUnknown / totalWeight) * 100;
      const pctAge = Object.fromEntries(Object.entries(age).map(([k, v]) => [k, (v / totalAge) * 100]));
      pctAge["미상"] = (ageUnknown / totalAge) * 100;
      const totalBreed = Object.values(breed).reduce((s, v) => s + v, 0) || 1;
      const breedArr = Object.entries(breed)
        .map(([name, v]) => ({ name, pct: (v / totalBreed) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 10);
      const weight_avg = wN > 0 ? Math.round((wAcc / wN) * 10) / 10 : 0;
      return { tx, aov_avg, pctDeath, pctWeight, pctAge, breedArr, weight_avg };
    }

    const tp = profileFor(topGroup);
    const bp = profileFor(botGroup);

    customer_profile_comparison![loc] = {
      top_managers: topGroup.map((m) => m.name),
      bot_managers: botGroup.map((m) => m.name),
      top_count: topGroup.length,
      bot_count: botGroup.length,
      top_aov_avg: tp.aov_avg,
      bot_aov_avg: bp.aov_avg,
      top_tx: tp.tx,
      bot_tx: bp.tx,
      death_cause: { top: tp.pctDeath, bot: bp.pctDeath },
      weight: { top: tp.pctWeight, bot: bp.pctWeight, top_avg: tp.weight_avg, bot_avg: bp.weight_avg },
      age: { top: tp.pctAge, bot: bp.pctAge },
      breed: { top: tp.breedArr, bot: bp.breedArr },
    };
  }

  const sortedTxDates = txEntries.map((e) => e.tx.date.getTime()).sort((a, b) => a - b);
  const minD = new Date(sortedTxDates[0]);
  const maxD = new Date(sortedTxDates[sortedTxDates.length - 1]);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    meta: {
      date_range: `${fmt(minD)} ~ ${fmt(maxD)}`,
      total_transactions: txEntries.length,
      generated_at: new Date().toISOString(),
    },
    locations,
    package_list: packageList,
    upsell_items: upsellItems,
    memorial_burial_items: memorialBurialItems,
    etc_add_items: etcAddItems,
    monthly,
    weekly,
    manager_aov,
    manager_strength_monthly,
    customer_profile_comparison,
  };
}
