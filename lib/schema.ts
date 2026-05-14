// DATA 구조 타입 (대시보드 렌더링 JS가 기대하는 모양)

export interface DashboardData {
  meta: {
    date_range: string;
    total_transactions: number;
    generated_at: string;
  };
  locations: string[]; // '전체' 포함
  package_list: string[];
  upsell_items: string[]; // 5품목: 관/요람장/수의/수의보/유골함
  memorial_burial_items: string[]; // 봉안당신규/연장 등
  etc_add_items: string[];
  monthly: PeriodBlock;
  weekly: PeriodBlock;
  manager_aov: ManagerAovBlock;
  manager_strength_monthly?: Record<string, ManagerStrengthMonthly>;
  customer_profile_comparison?: Record<string, CustomerProfileComparison>;
}

export interface PeriodBlock {
  periods: string[]; // 예: ['2024-01', ...]
  by_location: Record<string, PeriodLocData>;
}

export interface PeriodLocData {
  amt_total: number[];
  amt_장례: number[];
  amt_부가: number[];
  amt_무게추가: number[];
  amt_부가_스톤: number[];
  amt_부가_봉안: number[];
  amt_부가_etc: number[];
  ["할인금액"]: number[];
  tx_count: number[];
  funeral_tx_count: number[];
  cnt_funeral: number[];
  package_amt: Record<string, number[]>; // 패키지명 -> 월별 매출
  package_cnt: Record<string, number[]>;
  pkg_amt_total: number[]; // 모든 패키지 매출 합
  pkg_with_upsell_count: Record<string, number[]>; // 패키지 안에서 업셀링 발생 거래수
  pkg_basic_only_count: Record<string, number[]>;
  pkg_stone_count: Record<string, number[]>;
  pkg_x_item_count: Record<string, Record<string, number[]>>; // [pkg][item] -> 월별
  upsell_amt: Record<string, number[]>; // [item] -> 월별 차액 합
  upsell_cnt: Record<string, number[]>;
  upsell_attach: Record<string, number[]>; // [item] -> 월별 발생률(%)
  memorial_stone: Record<string, { amt: number[]; cnt: number[] }>; // 스톤제작/스톤함
  memorial_burial: Record<string, { amt: number[]; cnt: number[] }>; // 봉안당신규/연장 등
  etc_add: Record<string, { amt: number[]; cnt: number[] }>;
}

export interface ManagerAovBlock {
  periods: string[];
  by_location: Record<
    string,
    {
      managers: string[];
      data: Record<
        string,
        {
          tx: number[];
          aov: (number | null)[];
          by_pkg_detail?: Record<string, ManagerPkgDetail>;
        }
      >;
    }
  >;
}

export interface ManagerPkgDetail {
  tx: number[];
  upsell_cnt: number[];
  basic_only_cnt: number[];
  stone_cnt: number[];
  by_item: Record<string, number[]>; // [item] -> 월별
}

export interface ManagerStrengthMonthly {
  periods: string[];
  by_period: Record<
    string,
    {
      avg: {
        aov: number;
        premium_pct: number;
        upsell_pct: number;
        stone_pct: number;
        upsell_amt_per_tx: number;
        tx: number;
      };
      managers: ManagerStrengthEntry[];
    }
  >;
}

export interface ManagerStrengthEntry {
  name: string;
  primary_loc: string;
  current_loc?: string;
  loc_dist?: Record<string, number>;
  tx: number;
  amt: number;
  aov: number;
  premium_pct: number;
  upsell_pct: number;
  stone_pct: number;
  upsell_amt_per_tx: number;
  pkg_dist?: Record<string, number>;
  tags: { name: string; icon: string; gap: number }[];
  stone_jejak_cnt?: number;
  stone_ham_cnt?: number;
  stone_total_cnt?: number;
  stone_tx?: number;
  stone_amt?: number;
  stone_item_aov?: number;
  charnel_new_cnt?: number;
  charnel_ext_cnt?: number;
  charnel_total_cnt?: number;
  charnel_amt?: number;
  charnel_item_aov?: number;
}

export interface CustomerProfileComparison {
  top_managers: string[];
  bot_managers: string[];
  top_count: number;
  bot_count: number;
  top_aov_avg: number;
  bot_aov_avg: number;
  top_tx: number;
  bot_tx: number;
  death_cause: { top: Record<string, number>; bot: Record<string, number> };
  weight: { top: Record<string, number>; bot: Record<string, number>; top_avg: number; bot_avg: number };
  age: { top: Record<string, number>; bot: Record<string, number> };
  breed: { top: { name: string; pct: number }[]; bot: { name: string; pct: number }[] };
}

// === 원본 거래 행 (엑셀에서 읽어들이는 raw 형식) ===
export interface TxRow {
  거래ID: string;
  날짜: string | Date; // 거래일자
  지점: string;
  지도사?: string;
  패키지?: string;
  장례매출?: number;
  부가매출?: number;
  무게추가?: number;
  할인금액?: number;
  추모전용?: boolean | string | number; // truthy면 장례거래에서 제외 (funeral_tx_count 분모)
}

export interface LineItemRow {
  거래ID: string;
  카테고리?: string; // '업셀링' | '스톤' | '봉안' | '기타' 등
  품목: string; // 관/요람장/수의/수의보/유골함/스톤제작/스톤함/봉안당신규/봉안당연장/...
  가격?: number; // 라인아이템 결제가
  기본가?: number; // 패키지 기본가 (없으면 0)
  수량?: number; // 기본 1
}

export interface CustomerRow {
  거래ID: string;
  보호자연령?: number | string;
  반려동물체중?: number; // kg
  반려동물품종?: string;
  사망원인?: string;
}

// === 패키지/품목 분류 상수 ===
export const UP5 = ["관", "요람장", "수의", "수의보", "유골함"];
export const UPSELL_ITEMS = ["관", "요람장", "수의", "수의보", "유골함", "스톤제작", "스톤함"];
export const STONE_ITEMS = ["스톤제작", "스톤함"];
export const PREMIUM_PACKAGES = new Set(["올인원", "자연닮음", "요람장", "관장례"]);
