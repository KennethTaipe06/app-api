import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { IUserRepository } from '../../../domain/repositories';
import { USER_REPOSITORY } from '../../../domain/repositories';
import { TokensDto } from '../../dtos';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(refreshToken: string): Promise<TokensDto> {
    // Verify the refresh token signature and expiration
    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }

    // Verify user exists and is active
    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o desactivado');
    }

    // Verify the refresh token matches the one stored in DB
    if (user.refreshToken !== refreshToken) {
      // Token was already rotated or revoked — force re-login
      await this.userRepository.updateRefreshToken(user.id, null);
      throw new UnauthorizedException('Refresh token revocado');
    }

    // Generate new token pair (rotation)
    const newPayload = { sub: user.id, email: user.email, role: user.role };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRES_IN || '4h') as any,
      }),
      this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
      }),
    ]);

    // Store the new refresh token (old one is now invalid)
    await this.userRepository.updateRefreshToken(user.id, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}
