import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { RegisterDto } from './dto/registerUser.dto';
import { LoginDto } from './dto/loginUser.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/redis/redis.service';


@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
     private redis: RedisService,
   
  ) {}

  async registerUser(registerUserDto: RegisterDto) {
    console.log('registerDto', registerUserDto);
    const saltRounds = 10;
    const hash = await bcrypt.hash(registerUserDto.password, saltRounds);

    const user = await this.userService.createUser({
      ...registerUserDto,
      password: hash,
    });

    const payload = { sub: user.id, username: user.name, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return { access_token: token };
  }

  async login(loginDto: LoginDto) {
    // findByEmail uses addSelect to include the hidden password column
    const user = await this.userService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // include role in JWT so guards can read it without a DB call
    const payload = { sub: user.id, username: user.name, role: user.role };

    // strip password before sending user object to frontend
    const { password, ...safeUser } = user;

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: safeUser,   // ← frontend reads user.role to redirect correctly
    };
  }


  async logout(token: string): Promise<void>{

    await this.redis.set(`blacklist:${token}`, true, 7 * 24 * 60 * 60 * 1000);
  }
}