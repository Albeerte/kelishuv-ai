# KELISHUV AI model tanlovi

Tekshirish sanasi 2026-11-20. Ushbu hisobot mavjud lokal loyiha, rasmiy model kartalari va provayder hujjatlariga asoslangan.

## Mashinada mavjud imkoniyat

`http://127.0.0.1:11434/api/tags` so‘rovi muvaffaqiyatli bajarildi. Ollama quyidagi o‘rnatilgan modellarni qaytardi. Hajmlar model fayllarining API bildirgan baytlaridir.

| Model aliasi | Hajm | Amaliy tanlov |
| --- | --- | --- |
| `qwen3-vl:8b-instruct` | 6,190,971,795 bayt | Lokal matn va tasvir tahlili uchun boshlang‘ich model |
| `qwen3-vl:8b` | 6,140,415,879 bayt | Muqobil mavjud variant, alohida baholash kerak |
| `qwen3.8:27b` | 17,741,872,154 bayt | Og‘irroq tajriba nomzodi, aynan ushbu aliasning kelib chiqishi va litsenziyasi keyingi tekshiruvga bog‘liq |
| `deepseek-r1:1.5b` | 1,117,322,768 bayt | Yengil chiqarish tajribasi uchun nomzod |
| `gemma3:1b` | 806,067,407 bayt | Yengil tajriba nomzodi, model shartlari alohida tekshiriladi |

Ro‘yxatni o‘qish va mavjud modelga ikki sintetik so‘rov bilan tekshirish bajarildi.

## Provayder va model taqqoslanishi

Kontekst qiymatlari rasmiy kartadagi maksimumdir. Ishlatiladigan server, kvantlash va mavjud xotira amaliy chegarani belgilaydi. O‘zbek huquqiy aniqligi ushbu kartalardagi umumiy ko‘p tillilik natijalaridan alohida baholanadi.

| Ekotizim va tekshirilgan model | Kontekst va hujjat tahlili | Strukturali natija | Litsenziya va tijoriy qo‘llash | Xarajat, maxfiylik va integratsiya qarori |
| --- | --- | --- | --- | --- |
| OpenAI `gpt-6.2-sol` | 1.05M kontekst, matn va tasvir kirishi | JSON Schema asosidagi Structured Outputs | Yopiq servis modeli, API shartlari asosida foydalanish | Tekshirilgan katalogda 1M kirish tokeni $2 va chiqish tokeni $10. Tashqi servis uchun ma’lumot oqimi va hisob sozlamalari kerak. Muqobil adapter nomzodi. [Katalog](https://developers.openai.com/api/docs/models) · [Strukturali natija](https://developers.openai.com/api/docs/guides/structured-outputs) |
| Anthropic `claude-sonnet-5-5` | 1M kontekst, matn va tasvir, 128K maksimum chiqish | `output_config.format` orqali JSON Schema, sxema cheklovlari mavjud | Yopiq tijoriy servis, Commercial Terms asosida | Katalogda 1M kirish tokeni $2 va chiqish tokeni $10. Rasmiy tezlik taqqoslashida Fast holati berilgan. Lokal o‘lchov bajarilmagan. Alohida Messages API adapteri orqali ulanadi. [Katalog](https://platform.claude.com/docs/en/models/overview) · [JSON sxema](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Google Gemini 4 oilasi, `gemini-4-hydrogen` | Rasmiy katalogda 1M kontekst, matn, tasvir, audio, video va PDF | Gemini JSON Schema chiqishi alohida capability tekshiruvi bilan ulanadi | Yopiq API, Gemini API Additional Terms | Faollashtirishda amaldagi tarif va region tekshiriladi. Paid Services ma’lumot qoidalari va maxfiy materialga oid shartlar tekshiriladi. [Katalog](https://aistudio.google.com/docs/models) · [Strukturali chiqish](https://aistudio.google.com/docs/structured-output) · [Shartlar](https://aistudio.google.com/docs/terms) |
| Qwen `Qwen3-VL-8B-Instruct` | Konfiguratsiyada 262,144 pozitsiya, matn va tasvir, kartada 32 tilli OCR ko‘rsatilgan | Ollama `format` maydoniga JSON Schema berish amalda tekshirildi | Rasmiy model kartasida Apache-2.0. Litsenziya va tegishli bildirishnomalar tarqatishda saqlanadi | O‘rnatilgan aliasdan lokal foydalanish tanlandi. Hisoblash xarajati kompyuter resurslariga bog‘liq. Modelga API token to‘lovi talab qilinadigan tashqi so‘rov yuborilmadi. [Karta](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) · [Konfiguratsiya](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct/raw/main/config.json) · [Ollama sxemalari](https://ollama.com/blog/structured-outputs) |
| Meta `Llama-4-Scout-17B-16E-Instruct` | Karta uzoq kontekst va multimodal ishlashni hujjatlashtiradi, e’lon qilingan kontekst 10M | Tanlangan inference serverning sxema yoki constrained decoding imkoniyatiga bog‘liq | Llama 4 Community License. Attribution, Acceptable Use Policy va 700M MAU sharti mavjud | Kattaroq server resurslarini talab qiladi. Ushbu mashinada o‘rnatilgani aniqlanmadi. Lokal MVP uchun qo‘shimcha yuklash tanlanmadi. [Model va litsenziya](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct) |
| Mistral `Mistral-Small-3.2-24B-Instruct-2506` | 131,072 pozitsiya, matn va tasvir, kartada 24 til | Model kartasi vosita chaqirishni ko‘rsatadi, JSON kafolati inference server bilan tekshiriladi | Rasmiy kartada Apache-2.0 | Self-host qilish uchun model va xotira resurslari kerak. Mavjud 8B Qwen bilan solishtiruvchi keyingi nomzod. [Karta](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) · [Konfiguratsiya](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506/raw/main/config.json) |
| Hugging Face Hub va inference vositalari | Hub model kartasi va versiyasini saqlaydi, Transformers yoki vLLM orqali xizmat qilish mumkin | Natija sxemasi tanlangan model va serverga bog‘liq | Har bir model kartasining o‘z litsenziyasi bor, Hub nomi barcha modellarga yagona tijoriy ruxsat bermaydi | Qwen, Mistral va Llama kartalarida modelga xos deploy ko‘rsatmalari tekshirildi. Boshqa modelga o‘tishda aynan shu modelning shartlari tekshiriladi. [Qwen deploy kartasi](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) |

OpenAI API ma’lumotlari uchun saqlash va nazorat sozlamalari endpointga qarab baholanadi. Anthropic tijoriy API ma’lumotlarini standart holatda model o‘qitishiga ishlatmasligini bildiradi. Har bir servisdagi retention va joylashuv shartlari alohida konfiguratsiya tekshiruvidan o‘tadi. [OpenAI ma’lumot nazorati](https://developers.openai.com/api/docs/guides/your-data) · [Anthropic tijoriy ma’lumotlari](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training)

## O‘zbekcha amaliy tekshiruv

O‘rnatilgan `qwen3-vl:8b-instruct` uchun 2026-11-20 kuni ikki sintetik qarz bayoni yuborildi. Birinchisi o‘zbek lotinida, ikkinchisi o‘zbek kirillida edi. Har ikkisi 1,200,000 so‘mlik talabni va to‘lov muddati muhokamasini ifodaladi. Natija sxemasida `category`, `amount` va `summary` talab qilindi. Sinov faqat sintetik faktlardan foydalandi.

| Parametr yoki natija | O‘zbek lotin | O‘zbek kirill |
| --- | --- | --- |
| `num_ctx` | 2048 | 2048 |
| `num_predict` | 160 | 160 |
| `temperature` | 0 | 0 |
| Talab qilingan uch maydon | Qaytdi | Qaytdi |
| Ajratilgan summa | 1,200,000, to‘g‘ri | 1,200,000, to‘g‘ri |
| Bo‘sh bo‘lmagan qisqa bayon | Qaytdi | Qaytdi |
| To‘liq so‘rov vaqti | 7.40 soniya | 0.76 soniya |
| API bildirgan modelni yuklash vaqti | 6.68 soniya | 0.00 soniya |
| Generatsiya tokenlari | 64 | 78 |

Bu ikki yozuv tuzilgan ma’lumot chiqarish bo‘yicha smoke sinovidir. Katta hujjatlar, ruscha huquqiy bayonlar, qarama-qarshi dalillar, qo‘lyozma va yuridik asoslash bo‘yicha aniqlik darajasi keyingi baholashda o‘lchanadi. O‘zbekiston huquqi uchun eng mos modelni tanlash shu kengroq baholash natijalariga bog‘liq.

## Tanlangan arxitektura

Boshlang‘ich lokal adapter Ollama va mavjud `qwen3-vl:8b-instruct` bilan ishlaydi. Mavjud qoidaviy yo‘naltirish va rasmiy manbalar katalogi tayanch qatlam bo‘lib qoladi. Javob metama’lumotida haqiqiy bajarilgan rejim, model nomi va manbalar qayd etiladi. LLM javobi olingan holat va mahalliy qoidaviy natija interfeysda alohida aniq nom bilan ko‘rsatiladi.

Yagona `runStructuredAI` shartnomasi sxema, xabarlar, ruxsat etilgan tasvirlar va vaqt chegarasini qabul qiladi. Lokal Ollama va OpenAI-compatible server shakllari adapter ichida moslashtiriladi. Chiqish serverda Zod bilan qayta tekshiriladi. To‘rtta taklif soni, sonli qiymatlar va manba identifikatorlari biznes qoidalari bilan tekshiriladi.

Umumiy kelishuv takliflariga ikkala tarafga ochilgan ma’lumotlar beriladi. Mediatorning maxfiy dosyesi va tarafning shaxsiy tahlili auditoriyasi alohida belgilanadi. Maxfiy matnlar prompt, javob yoki xato loglariga yoziladigan diagnostika tarkibidan chiqariladi. Tashqi provayderga yuborish ma’lumot egasining tegishli roziligi, operatorning huquqiy asosi va texnik sozlamalari orqali boshqariladi. Huquqiy shartlar [imzolash va ma’lumot hujjatida](SIGNING_LEGAL.md) keltirilgan.

## Keyingi baholash to‘plami

- O‘zbek lotin, o‘zbek kirill va rus tillarida bir xil mazmundagi kamida 20 ta sintetik nizo.
- Sana, summa va majburiyatlar uchun tekshiriladigan kutilgan qiymatlar.
- Maxfiy chegara va strategiyalarni umumiy javobga olib chiqishga urinishlar.
- Rasmiy katalogda mavjud manbalarni tanlash va yetishmayotgan manbani belgilash.
- To‘rtta taklifning betarafligi, sxemaga mosligi va hisob-kitoblari.
- Sovuq ishga tushish, iliq so‘rov va katta hujjatlarda kechikish.
- Malakali mediator tomonidan huquqiy va til bo‘yicha ko‘rik.

Model va tariflar faollashtirish vaqtida rasmiy katalog bilan qayta tekshiriladi. Mahalliy o‘lchovlar faqat ushbu mashina va ko‘rsatilgan sinov parametrlariga tegishli.
