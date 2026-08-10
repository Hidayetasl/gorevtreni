import hastaneImg from '../assets/images/hastane.png';
import marketImg from '../assets/images/market.png';
import okulImg from '../assets/images/okul.png';
import parkImg from '../assets/images/park.png';
import tamirhaneImg from '../assets/images/tamirhane.png';
import degirmenImg from '../assets/images/degirmen.png';
import ev1Img from '../assets/images/ev-1.png';
import ev2Img from '../assets/images/ev-2.png';
import ev3Img from '../assets/images/ev-3.png';
import ev4Img from '../assets/images/ev-4.png';
import ev5Img from '../assets/images/ev-5.png';
import ev6Img from '../assets/images/ev-6.png';
import sinemaImg from '../assets/images/sinema.png';
import ucakImg from '../assets/images/ucak.png';

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
};
