import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterDto } from 'src/auth/dto/registerUser.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  //used by AuthService on register 
  async createUser(registerUserDto: RegisterDto) {
    try {
      return await this.usersRepository.save({
        name: registerUserDto.name,
        email: registerUserDto.email,
        mobile: registerUserDto.mobile,
        password: registerUserDto.password,
        address: registerUserDto.address,
      });
    } catch (err) {
      console.log(err);
      const e = err as { code?: string };
      if (e.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email is already taken');
      }
      throw err;
    }
  }

  // used by AuthService on login
  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')   
      .where('user.email = :email', { email })
      .getOne();
  }

  // only admin

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return user;
  }

  async adminCreateUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const saltRounds = 10;
      const hash = await bcrypt.hash(createUserDto.password, saltRounds);

      return await this.usersRepository.save({
        ...createUserDto,
        password: hash,
      });
    } catch (err) {
      console.log(err);
      const e = err as { code?: string };
      if (e.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email is already taken');
      }
      throw err;
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    // will throw error if not exist
    await this.findOne(id);

    // if password is being updated, hash it first
    if (updateUserDto.password) {
      const saltRounds = 10;
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        saltRounds,
      );
    }

    await this.usersRepository.update(id, updateUserDto);

    // return fresh updated user
    return await this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.usersRepository.delete(id);

    return { message: `User #${id} deleted successfully` };
  }
}