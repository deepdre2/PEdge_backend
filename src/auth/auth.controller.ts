import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/registerUser.dto';
import { LoginDto } from './dto/loginUser.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
  async register(@Body() registerUserDto: RegisterDto){
        // logic comes here but main logic will be in services by nest g s auth command
       const token = await this.authService.registerUser(registerUserDto);
       return token;
    }

    // @HttpCode(HttpStatus.OK) // Returns 200 instead of 201
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return await this.authService.login(loginDto);
    }  
    
}
