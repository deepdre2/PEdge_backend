import { IsString, IsEmail, Length } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 50)
  password!: string;
}