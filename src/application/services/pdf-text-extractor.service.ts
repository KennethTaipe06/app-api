import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfTextExtractorService {
  private readonly logger = new Logger(PdfTextExtractorService.name);
  private readonly MAX_TEXT_CHARS = 60_000; // ~ 15 paginas

  async extractText(buffer: Buffer): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const raw = (data?.text || '').replace(/\s+/g, ' ').trim();
      if (!raw) return null;
      return raw.slice(0, this.MAX_TEXT_CHARS);
    } catch (err) {
      this.logger.warn(
        `Error extrayendo texto de PDF: ${(err as Error)?.message}`,
      );
      return null;
    }
  }
}
