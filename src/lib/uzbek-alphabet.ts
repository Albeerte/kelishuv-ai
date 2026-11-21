const protectedText = /(```[\s\S]*?```|(?<!\p{L})`[^`\n]*`|(?:https?:\/\/|www\.)[^\s<>]+|(?<![\p{L}\p{N}.!#$%&'*+/=?^_`{|}~‘’ʻʼ´-])(?:"[^"\r\n]{1,64}"|[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~‘’ʻʼ´-]{1,64})@[\p{L}\p{N}.-]{1,253}|\b(?:SHA(?:-\d+)?|HMAC(?:-\d+)?|ChatGPT|OpenSearch|Getsherik|shadcn)\b)/giu;
const dottedLetters: Record<string, string> = { O: "Ö", o: "ö", G: "Ğ", g: "ğ" };

/** The letter substitutions requested for the Uzbek interface and project copy. */
export function toModernUzbek(text: string): string {
  return text
    .split(protectedText)
    .map((part, index) => {
      if (index % 2) return part;
      return part.normalize("NFC").replace(/[\p{L}\p{N}_‘’ʻʼ'`´-]+/gu, (word) => {
        // References and machine keys have a digit or underscore alongside a separator.
        if (/[-_]/.test(word) && /[\d_]/.test(word)) return word;
        return word
          .replace(/[oOgG][‘’ʻʼ'`´]/g, (pair) => dottedLetters[pair[0]])
          .replace(/sh|ch/gi, (pair) => {
            const letter = pair[0].toLowerCase() === "s" ? "ş" : "ç";
            return pair[0] === pair[0].toUpperCase() ? letter.toUpperCase() : letter;
          });
      });
    })
    .join("");
}

/** Canonical spelling for matching existing records and legal source text. */
export function toTraditionalUzbek(text: string): string {
  const letters: Record<string, string> = {
    Ö: "O‘", ö: "o‘", Ğ: "G‘", ğ: "g‘",
    Ş: "Sh", ş: "sh", Ç: "Ch", ç: "ch",
  };
  return text.normalize("NFC").replace(/\p{L}+/gu, (word) => {
    const uppercase = word === word.toUpperCase();
    return word.replace(/[ÖöĞğŞşÇç]/g, (letter) =>
      uppercase ? letters[letter].toUpperCase() : letters[letter],
    );
  });
}

export function normalizeUzbekSearch(text: string): string {
  return toTraditionalUzbek(text)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "");
}
