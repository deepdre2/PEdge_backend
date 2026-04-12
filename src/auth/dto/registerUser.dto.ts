import { IsString, IsEmail, IsOptional, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 50)
  password!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  mobile?: string;
}