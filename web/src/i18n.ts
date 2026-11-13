export type Lang = "en" | "nl";

const strings = {
  en: {
    tagline: "Combine PDF files into one, right in your browser.",
    privacy: "Your files are never uploaded. Everything happens on your own device.",
    dropTitle: "Drop PDF files here",
    dropSub: "or use + to add files, then drag to reorder",
    add: "＋ Add files",
    clear: "Clear",
    export: "Combine & download",
    remove: "Remove",
    pages: "{n} p",
    encrypted: "password-protected",
    invalid: "not a valid PDF",
    unreadable: "can't read file",
    skipped: "Skipped {n} file(s) that aren't PDFs.",
    merging: "Combining…",
    done: "Downloaded {name}.",
    errEncrypted: "{name} is password-protected and can't be combined.",
    errInvalid: "{name} is not a valid PDF or is damaged.",
    errGeneric: "Something went wrong while combining: {msg}",
    disclaimerShort:
      "You are responsible for the files you combine here. Only use documents you are allowed to process.",
    howItWorks: "How it works & disclaimer",
    back: "← Back to JoinPDF",
    source: "Open source on GitHub",
  },
  nl: {
    tagline: "Voeg pdf-bestanden samen tot één bestand, gewoon in je browser.",
    privacy: "Je bestanden worden nooit geüpload. Alles gebeurt op je eigen apparaat.",
    dropTitle: "Sleep pdf-bestanden hierheen",
    dropSub: "of gebruik + om bestanden toe te voegen, en sleep om de volgorde te wijzigen",
    add: "＋ Bestanden toevoegen",
    clear: "Wissen",
    export: "Samenvoegen & downloaden",
    remove: "Verwijderen",
    pages: "{n} p",
    encrypted: "beveiligd met wachtwoord",
    invalid: "geen geldige pdf",
    unreadable: "bestand niet leesbaar",
    skipped: "{n} bestand(en) overgeslagen die geen pdf zijn.",
    merging: "Bezig met samenvoegen…",
    done: "{name} gedownload.",
    errEncrypted: "{name} is beveiligd met een wachtwoord en kan niet worden samengevoegd.",
    errInvalid: "{name} is geen geldige pdf of is beschadigd.",
    errGeneric: "Er ging iets mis bij het samenvoegen: {msg}",
    disclaimerShort:
      "Je bent zelf verantwoordelijk voor de bestanden die je hier samenvoegt. Gebruik alleen documenten die je mag verwerken.",
    howItWorks: "Hoe het werkt & disclaimer",
    back: "← Terug naar JoinPDF",
    source: "Open source op GitHub",
  },
} satisfies Record<Lang, Record<string, string>>;

export type Key = keyof (typeof strings)["en"];

const STORAGE_KEY = "joinpdf-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "nl") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith("nl") ? "nl" : "en";
}

let current: Lang = detect();
const listeners = new Set<() => void>();

export function lang(): Lang {
  return current;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return strings[current][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

/** Applies the language to <html lang>, [data-i18n] elements and the switch buttons. */
function apply(): void {
  document.documentElement.lang = current;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.setLang === current));
  });
  for (const fn of listeners) fn();
}

export function setLang(next: Lang): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
  apply();
}

export function initI18n(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.setLang as Lang));
  });
  apply();
}
