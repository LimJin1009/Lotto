// 꿈 해몽 번호. 해몽 풀이와 숫자는 이 앱이 정한 재미용 해석이다.
import { randomNumbers } from './random';
import { finishSet, type GenResult } from './types';

export type DreamCategory = '동물' | '사람' | '자연' | '돈·물건' | '몸·행동';

export const DREAM_CATEGORIES: DreamCategory[] = ['동물', '사람', '자연', '돈·물건', '몸·행동'];

export interface Situation {
  label: string;
  meaning: string;
  num: number;
}

export interface Dream {
  id: string;
  name: string;
  emoji: string;
  category: DreamCategory;
  meaning: string;
  /** 꿈 자체의 상징 숫자 */
  nums: number[];
  situations: Situation[];
}

export const DREAMS: Dream[] = [
  // 동물
  { id: 'pig', name: '돼지꿈', emoji: '🐷', category: '동물', meaning: '대표적인 재물 꿈. 뜻밖의 돈이 들어올 기운', nums: [8, 28],
    situations: [
      { label: '돼지가 집에 들어옴', meaning: '복이 스스로 찾아옴', num: 1 },
      { label: '돼지를 안거나 업음', meaning: '재물을 손에 쥠', num: 17 },
      { label: '새끼 돼지가 여러 마리', meaning: '작은 행운이 여러 번', num: 33 },
    ] },
  { id: 'dragon', name: '용꿈', emoji: '🐉', category: '동물', meaning: '크게 성공하고 이름을 떨칠 기운', nums: [5, 39],
    situations: [
      { label: '용이 하늘로 올라감', meaning: '하는 일이 크게 풀림', num: 45 },
      { label: '용이 나를 감쌈', meaning: '귀한 사람의 도움', num: 12 },
      { label: '여의주를 받음', meaning: '바라던 일이 이루어짐', num: 27 },
    ] },
  { id: 'snake', name: '뱀꿈', emoji: '🐍', category: '동물', meaning: '재물과 귀한 인연이 들어올 기운', nums: [6, 31],
    situations: [
      { label: '뱀에게 물림', meaning: '피할 수 없는 큰 재물', num: 19 },
      { label: '큰 구렁이를 봄', meaning: '집안에 들어오는 큰 복', num: 40 },
      { label: '뱀이 몸을 감음', meaning: '좋은 인연과 이어짐', num: 2 },
    ] },
  { id: 'tiger', name: '호랑이꿈', emoji: '🐯', category: '동물', meaning: '힘과 권위, 든든한 후원자를 얻을 기운', nums: [3, 36],
    situations: [
      { label: '호랑이가 따라옴', meaning: '귀인이 나를 지켜줌', num: 22 },
      { label: '호랑이를 탐', meaning: '높은 자리에 오름', num: 44 },
      { label: '새끼 호랑이를 안음', meaning: '새로 시작한 일이 자람', num: 9 },
    ] },
  { id: 'cow', name: '소꿈', emoji: '🐮', category: '동물', meaning: '꾸준히 쌓이는 재물과 성실한 결실', nums: [2, 25],
    situations: [
      { label: '소가 집에 들어옴', meaning: '집안 살림이 넉넉해짐', num: 14 },
      { label: '소를 끌고 감', meaning: '내 힘으로 재물을 모음', num: 38 },
    ] },
  { id: 'fish', name: '물고기꿈', emoji: '🐟', category: '동물', meaning: '풍요와 기쁜 소식', nums: [11, 29],
    situations: [
      { label: '큰 물고기를 잡음', meaning: '큰 수확', num: 43 },
      { label: '물고기가 가득함', meaning: '재물이 넘쳐남', num: 7 },
      { label: '잉어가 뛰어오름', meaning: '시험·승진 운', num: 21 },
    ] },
  { id: 'bird', name: '새꿈', emoji: '🐦', category: '동물', meaning: '반가운 소식과 새로운 기회', nums: [4, 32],
    situations: [
      { label: '새가 품에 날아듦', meaning: '좋은 소식이 바로 옴', num: 18 },
      { label: '봉황·학을 봄', meaning: '귀한 일이 생김', num: 41 },
    ] },
  { id: 'dog', name: '개꿈', emoji: '🐶', category: '동물', meaning: '믿을 만한 사람과 든든한 도움', nums: [10, 26],
    situations: [
      { label: '개가 반갑게 꼬리침', meaning: '좋은 친구가 생김', num: 35 },
      { label: '강아지를 얻음', meaning: '작은 행운이 찾아옴', num: 16 },
    ] },
  { id: 'turtle', name: '거북이꿈', emoji: '🐢', category: '동물', meaning: '오래가는 복과 건강', nums: [13, 42],
    situations: [
      { label: '거북이가 집에 들어옴', meaning: '집안에 오래 머무는 복', num: 24 },
      { label: '거북이 등에 탐', meaning: '어려움을 무사히 넘김', num: 5 },
    ] },
  { id: 'cat', name: '고양이꿈', emoji: '🐱', category: '동물', meaning: '눈치와 재치로 기회를 잡음', nums: [9, 30],
    situations: [
      { label: '고양이가 안겨 옴', meaning: '뜻밖의 선물', num: 20 },
      { label: '고양이가 쥐를 잡음', meaning: '골칫거리가 해결됨', num: 37 },
    ] },

  // 사람
  { id: 'ancestor', name: '조상꿈', emoji: '👴', category: '사람', meaning: '조상이 알려주는 행운. 복권 꿈으로 유명', nums: [1, 19],
    situations: [
      { label: '조상이 웃으며 나타남', meaning: '집안에 좋은 일', num: 33 },
      { label: '조상이 무언가를 건넴', meaning: '재물을 받음', num: 8 },
      { label: '조상이 숫자를 알려줌', meaning: '행운의 신호', num: 45 },
    ] },
  { id: 'president', name: '대통령꿈', emoji: '🎖️', category: '사람', meaning: '높은 사람의 인정과 큰 기회', nums: [7, 40],
    situations: [
      { label: '대통령과 악수함', meaning: '귀인의 도움', num: 15 },
      { label: '대통령과 밥을 먹음', meaning: '복이 함께함', num: 27 },
    ] },
  { id: 'celebrity', name: '연예인꿈', emoji: '🌟', category: '사람', meaning: '주목받고 인기가 오름', nums: [14, 34],
    situations: [
      { label: '연예인과 데이트함', meaning: '바라던 일이 다가옴', num: 3 },
      { label: '연예인에게 선물을 받음', meaning: '뜻밖의 수입', num: 23 },
    ] },
  { id: 'baby', name: '아기꿈', emoji: '👶', category: '사람', meaning: '새로운 시작과 기쁜 일', nums: [1, 23],
    situations: [
      { label: '아기를 안음', meaning: '새 일이 잘 풀림', num: 11 },
      { label: '아기가 웃음', meaning: '집안에 웃을 일', num: 36 },
    ] },
  { id: 'wedding', name: '결혼꿈', emoji: '💍', category: '사람', meaning: '새로운 계약과 좋은 결합', nums: [2, 22],
    situations: [
      { label: '내가 결혼함', meaning: '중요한 약속이 이루어짐', num: 30 },
      { label: '결혼식에 감', meaning: '주변의 경사', num: 6 },
    ] },
  { id: 'death', name: '죽는 꿈', emoji: '🕯️', category: '사람', meaning: '흉몽이 아니라 새로 태어나는 길몽', nums: [4, 44],
    situations: [
      { label: '내가 죽음', meaning: '묵은 일이 끝나고 새 출발', num: 13 },
      { label: '장례식을 봄', meaning: '걱정이 사라짐', num: 31 },
    ] },

  // 자연
  { id: 'fire', name: '불꿈', emoji: '🔥', category: '자연', meaning: '활활 타오르는 재물과 번창', nums: [9, 27],
    situations: [
      { label: '집에 불이 남', meaning: '집안이 크게 일어남', num: 3 },
      { label: '불길이 크게 번짐', meaning: '사업이 번창함', num: 39 },
      { label: '불을 끔', meaning: '조심하면 지킬 수 있는 재물', num: 16 },
    ] },
  { id: 'water', name: '물꿈', emoji: '🌊', category: '자연', meaning: '맑은 물은 재물, 흐름이 트임', nums: [6, 16],
    situations: [
      { label: '맑은 물이 넘침', meaning: '재물이 넘쳐 들어옴', num: 42 },
      { label: '홍수가 남', meaning: '큰돈이 한꺼번에', num: 29 },
      { label: '물에 들어가 헤엄침', meaning: '일이 술술 풀림', num: 10 },
    ] },
  { id: 'sun', name: '해꿈', emoji: '☀️', category: '자연', meaning: '밝은 앞날과 큰 성공', nums: [1, 12],
    situations: [
      { label: '해가 떠오름', meaning: '새로운 기회', num: 21 },
      { label: '해가 품에 들어옴', meaning: '아주 큰 복', num: 45 },
    ] },
  { id: 'moon', name: '달꿈', emoji: '🌕', category: '자연', meaning: '소원 성취와 차오르는 복', nums: [15, 30],
    situations: [
      { label: '보름달을 봄', meaning: '바라던 일이 가득 참', num: 8 },
      { label: '달을 손에 쥠', meaning: '귀한 것을 얻음', num: 38 },
    ] },
  { id: 'mountain', name: '산꿈', emoji: '⛰️', category: '자연', meaning: '든든한 기반과 오름세', nums: [8, 35],
    situations: [
      { label: '산 정상에 오름', meaning: '목표를 이룸', num: 44 },
      { label: '산에서 보물을 찾음', meaning: '숨은 재물', num: 18 },
    ] },
  { id: 'rainbow', name: '무지개꿈', emoji: '🌈', category: '자연', meaning: '좋은 일이 연달아 생김', nums: [7, 17],
    situations: [
      { label: '쌍무지개를 봄', meaning: '기쁜 일이 두 번', num: 34 },
      { label: '무지개를 건넘', meaning: '어려움이 끝남', num: 25 },
    ] },
  { id: 'snow', name: '눈꿈', emoji: '❄️', category: '자연', meaning: '깨끗한 새 출발과 소복이 쌓이는 복', nums: [12, 33],
    situations: [
      { label: '함박눈이 쌓임', meaning: '재물이 쌓임', num: 41 },
      { label: '눈 위를 걸음', meaning: '새 길이 열림', num: 4 },
    ] },
  { id: 'flower', name: '꽃꿈', emoji: '🌸', category: '자연', meaning: '좋은 인연과 활짝 피는 운', nums: [5, 24],
    situations: [
      { label: '꽃이 활짝 핌', meaning: '하는 일이 빛을 봄', num: 37 },
      { label: '꽃다발을 받음', meaning: '축하받을 일', num: 13 },
    ] },

  // 돈·물건
  { id: 'money', name: '돈꿈', emoji: '💰', category: '돈·물건', meaning: '재물이 들어오거나 쓸 곳이 생김', nums: [10, 20],
    situations: [
      { label: '돈을 주움', meaning: '뜻밖의 수입', num: 40 },
      { label: '돈을 받음', meaning: '노력의 대가', num: 30 },
      { label: '돈다발을 셈', meaning: '큰 재물을 다룸', num: 2 },
    ] },
  { id: 'gold', name: '금꿈', emoji: '🥇', category: '돈·물건', meaning: '변하지 않는 큰 재물', nums: [18, 36],
    situations: [
      { label: '금덩이를 얻음', meaning: '큰 재산', num: 9 },
      { label: '금반지를 낌', meaning: '좋은 약속과 명예', num: 26 },
    ] },
  { id: 'poop', name: '똥꿈', emoji: '💩', category: '돈·물건', meaning: '복권 꿈의 대표. 더러울수록 큰 재물', nums: [3, 33],
    situations: [
      { label: '똥을 밟음', meaning: '재물이 발에 붙음', num: 13 },
      { label: '똥이 몸에 묻음', meaning: '피할 수 없는 큰돈', num: 43 },
      { label: '화장실에 똥이 가득함', meaning: '재물이 넘침', num: 23 },
    ] },
  { id: 'lottery', name: '복권꿈', emoji: '🎟️', category: '돈·물건', meaning: '말 그대로 행운의 신호', nums: [7, 45],
    situations: [
      { label: '복권에 당첨됨', meaning: '기대가 현실로', num: 1 },
      { label: '복권을 삼', meaning: '기회를 잡음', num: 19 },
    ] },
  { id: 'house', name: '집꿈', emoji: '🏠', category: '돈·물건', meaning: '안정과 재산이 늘어남', nums: [4, 14],
    situations: [
      { label: '새 집으로 이사함', meaning: '형편이 나아짐', num: 28 },
      { label: '큰 집을 얻음', meaning: '재산이 불어남', num: 42 },
    ] },
  { id: 'car', name: '자동차꿈', emoji: '🚗', category: '돈·물건', meaning: '일이 빠르게 진행됨', nums: [11, 22],
    situations: [
      { label: '새 차를 받음', meaning: '새로운 자리·기회', num: 35 },
      { label: '좋은 차를 운전함', meaning: '내 뜻대로 풀림', num: 6 },
    ] },
  { id: 'rice', name: '쌀·곡식꿈', emoji: '🌾', category: '돈·물건', meaning: '먹을 것이 넉넉해지는 재물', nums: [15, 25],
    situations: [
      { label: '쌀가마가 쌓임', meaning: '창고가 가득 참', num: 44 },
      { label: '곡식을 거둠', meaning: '노력의 결실', num: 5 },
    ] },
  { id: 'jewel', name: '보석꿈', emoji: '💎', category: '돈·물건', meaning: '귀한 물건과 귀한 사람', nums: [16, 38],
    situations: [
      { label: '보석을 선물받음', meaning: '귀인이 생김', num: 7 },
      { label: '보석을 캠', meaning: '숨은 재능·재물 발견', num: 29 },
    ] },

  // 몸·행동
  { id: 'teeth', name: '이빨 빠지는 꿈', emoji: '🦷', category: '몸·행동', meaning: '변화가 오는 신호. 낡은 것을 정리할 때', nums: [8, 32],
    situations: [
      { label: '이가 쑥 빠짐', meaning: '걱정거리가 떨어져 나감', num: 21 },
      { label: '새 이가 남', meaning: '새로운 출발', num: 1 },
    ] },
  { id: 'fly', name: '하늘을 나는 꿈', emoji: '🕊️', category: '몸·행동', meaning: '자유롭고 높이 오르는 운', nums: [13, 43],
    situations: [
      { label: '높이 날아오름', meaning: '크게 성공함', num: 45 },
      { label: '낮게 떠다님', meaning: '마음이 편해짐', num: 20 },
    ] },
  { id: 'blood', name: '피꿈', emoji: '🩸', category: '몸·행동', meaning: '피는 재물을 뜻하는 길몽', nums: [9, 19],
    situations: [
      { label: '피를 많이 흘림', meaning: '큰 재물이 들어옴', num: 39 },
      { label: '피가 몸에 묻음', meaning: '재물과 인연이 닿음', num: 28 },
    ] },
  { id: 'chase', name: '쫓기는 꿈', emoji: '🏃', category: '몸·행동', meaning: '마음의 부담. 이겨내면 큰 결실', nums: [17, 37],
    situations: [
      { label: '끝까지 도망침', meaning: '위기를 벗어남', num: 3 },
      { label: '돌아서서 맞섬', meaning: '문제를 해결함', num: 31 },
    ] },
  { id: 'exam', name: '시험 보는 꿈', emoji: '📝', category: '몸·행동', meaning: '평가받을 일이 다가옴', nums: [2, 20],
    situations: [
      { label: '시험에 합격함', meaning: '노력을 인정받음', num: 41 },
      { label: '답을 다 앎', meaning: '준비가 끝남', num: 12 },
    ] },
  { id: 'eat', name: '맛있게 먹는 꿈', emoji: '🍚', category: '몸·행동', meaning: '먹을 복과 재물 복', nums: [6, 26],
    situations: [
      { label: '잔칫상을 받음', meaning: '큰 대접을 받음', num: 34 },
      { label: '고기를 먹음', meaning: '힘과 재물을 얻음', num: 15 },
    ] },
];

export function dreamNumbers(dream: Dream, situation?: Situation): GenResult {
  const picks = [
    ...(situation ? [{ n: situation.num, reason: `${situation.label} — ${situation.meaning}` }] : []),
    ...dream.nums.map((n) => ({ n, reason: `${dream.name}의 상징 숫자` })),
  ];
  return {
    method: 'dream',
    emoji: dream.emoji,
    title: situation ? `${dream.name} · ${situation.label}` : dream.name,
    note: situation ? `${dream.meaning}. ${situation.meaning}.` : `${dream.meaning}.`,
    ...finishSet(picks, randomNumbers, '꿈의 기운으로 뽑은 숫자'),
  };
}
