import hastaneImg from '../assets/images/hastane.webp';
import marketImg from '../assets/images/market.webp';
import okulImg from '../assets/images/okul.webp';
import parkImg from '../assets/images/park.webp';
import tamirhaneImg from '../assets/images/tamirhane.webp';
import degirmenImg from '../assets/images/degirmen.webp';
import ev1Img from '../assets/images/ev-1.webp';
import ev2Img from '../assets/images/ev-2.webp';
import ev3Img from '../assets/images/ev-3.webp';
import ev4Img from '../assets/images/ev-4.webp';
import ev5Img from '../assets/images/ev-5.webp';
import ev6Img from '../assets/images/ev-6.webp';
import sinemaImg from '../assets/images/sinema.webp';
import ucakImg from '../assets/images/ucak.webp';
import ambulansImg from '../assets/images/ambulans.webp';
import itfaiyeImg from '../assets/images/itfaiye.webp';
import sincapImg from '../assets/images/sincap.webp';
import kirmiziKopruImg from '../assets/images/kirmizi-kopru.webp';
import fiskiyeImg from '../assets/images/fiskiye.webp';
import firinImg from '../assets/images/firin.webp';
import lunaparkImg from '../assets/images/lunapark.webp';
import dagTuneliImg from '../assets/images/dag-tuneli.webp';
import itfaiyeIstasyonuImg from '../assets/images/itfaiye-istasyonu.webp';
import altinVagonuImg from '../assets/images/altin-vagonu.webp';
import elmaVagonuImg from '../assets/images/elma-vagonu.webp';
import oyuncakVagonuImg from '../assets/images/oyuncak-vagonu.webp';

// Mağaza / dünya eşyası kimliğine göre gerçek çizim görseli. Bir eşya burada
// yoksa eski emoji simgesiyle gösterilmeye devam eder (geriye dönük uyumlu).
export const SCENERY_IMAGES: Record<string, string> = {
  'scenery-hospital': hastaneImg,
  'scenery-market': marketImg,
  'scenery-school': okulImg,
  'scenery-park': parkImg,
  'scenery-train-repair': tamirhaneImg,
  'scenery-windmill': degirmenImg,
  'scenery-house': ev1Img,
  'scenery-house-2': ev2Img,
  'scenery-house-3': ev3Img,
  'scenery-house-4': ev4Img,
  'scenery-house-5': ev5Img,
  'scenery-house-6': ev6Img,
  'scenery-cinema': sinemaImg,
  'scenery-airplane': ucakImg,
  'scenery-ambulance': ambulansImg,
  'scenery-firestation': itfaiyeImg,
  'scenery-squirrel-courier': sincapImg,
  'track-bridge': kirmiziKopruImg,
  'scenery-fountain': fiskiyeImg,
  'scenery-bakery': firinImg,
  'scenery-ferris': lunaparkImg,
  'track-tunnel': dagTuneliImg,
  'scenery-firestation-building': itfaiyeIstasyonuImg,
  'wagon-coins': altinVagonuImg,
  'wagon-fruits': elmaVagonuImg,
  'wagon-toys': oyuncakVagonuImg,
};
