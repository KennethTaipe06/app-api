import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);

  async processToH265(
    inputPath: string,
  ): Promise<{ outputPath: string; sizeBytes: number }> {
    const outputPath = path.join(os.tmpdir(), `${randomUUID()}_output.mp4`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx265') // H.265 (HEVC)
        .outputOptions([
          '-vf scale=-2:720', // 720p
          '-r 15', // 15fps
          '-crf 28', // Buen balance calidad/peso, resultando típicamente en 0.3-0.6 GB para ~1.5 - 2 horas
          '-preset fast',
          '-movflags +faststart',
        ])
        .on('start', (commandLine) => {
          this.logger.debug(`Ejecutando FFmpeg: ${commandLine}`);
        })
        .on('error', (err) => {
          this.logger.error(`Error procesando video en H.265: ${err.message}`);
          this.cleanup(outputPath).finally(() => reject(err));
        })
        .on('end', () => {
          this.logger.debug('Procesamiento de video completado.');
          void fs
            .stat(outputPath)
            .then((stat) => {
              resolve({ outputPath, sizeBytes: stat.size });
            })
            .catch((readErr) => {
              this.cleanup(outputPath).finally(() => reject(readErr));
            });
        })
        .save(outputPath);
    });
  }

  private async cleanup(file: string) {
    try {
      await fs.unlink(file);
    } catch {
      // Ignorar errores al eliminar
    }
  }
}
