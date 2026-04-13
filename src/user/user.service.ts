import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterDto } from 'src/auth/dto/registerUser.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
// import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

import { RedisService } from 'src/redis/redis.service';




const LIST_KEY = (page: number) => `users:list:p:${page}`; // CHANGED: was one static key, now per-page
const USER_BY_ID = (id: number)   => `user:${id}`;
const USER_BY_EMAIL = (email: string)=> `user:email:${email}`;  // FIXED: was user:${email}
const TTL_LIST = 2  * 60 * 1000;
const TTL_DETAIL = 10 * 60 * 1000;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private redis: RedisService,
  ) {}



  //used by AuthService on register 
  async createUser(registerUserDto: RegisterDto) {
    try {
      const user = await this.usersRepository.save({
        name: registerUserDto.name,
        email: registerUserDto.email,
        mobile: registerUserDto.mobile,
        password: registerUserDto.password,
        address: registerUserDto.address,
      });
      await this.invalidateListCache();  
       return user;
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
    const key = USER_BY_EMAIL(email);
    const cached = await this.redis.get<User>(key);
    if(cached) return cached;


    const user = await this.usersRepository
          .createQueryBuilder('user')
          .addSelect('user.password')   
          .where('user.email = :email', { email })
          .getOne();

          if(user) await this.redis.set(key, user, 5 * 60 * 1000); // 5 min
          return user;
      }


  async searchByEmail(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.name', 'user.email', 'user.mobile'])
      .where('user.email LIKE :email', { email: `%${email}%` })
      .limit(20)
      .getMany();
  }

  // only admin

  async findAll(page = 1, limit = 50): Promise<{data: User[]; total: number}> {
    const key = LIST_KEY(page); 
    const cached = await this.redis.get<{ data: User[]; total: number }>(key);
     if (cached) return cached;
   
     const [data, total] = await this.usersRepository.findAndCount({
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });


    const result = { data, total };
    await this.redis.set(key, result, 60 * 1000);
    return result;
  }

  async findOne(id: number): Promise<User> {
    const key = USER_BY_ID(id);
    const cached = await this.redis.get<User>(key);
    if(cached) return cached;


    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    await this.redis.set(key, user, 5* 60 * 1000); // 5 min

    return user;
  }

  async adminCreateUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const saltRounds = 10;
      const hash = await bcrypt.hash(createUserDto.password, saltRounds);

      const result = await this.usersRepository.save({
        ...createUserDto,
        password: hash,
      });

      await this.invalidateListCache();
       return result;

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
    const existing = await this.findOne(id);

    // if password is being updated, hash it first
    if (updateUserDto.password) {
      const saltRounds = 10;
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        saltRounds,
      );
    }

    await this.usersRepository.update(id, updateUserDto);

    // updating cache
    await Promise.all([
      this.redis.del(USER_BY_ID(id)),
     this.redis.del(USER_BY_EMAIL(existing.email)), 

      updateUserDto.email
      ? this.redis.del(USER_BY_EMAIL(updateUserDto.email))
      : Promise.resolve(),
      this.invalidateListCache(),
    ]);
    // return fresh updated user
    return await this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.findOne(id);

    await this.usersRepository.delete(id);
   
    // delete cache
    await Promise.all([
      this.redis.del(USER_BY_ID(id)),
      this.redis.del(USER_BY_EMAIL(user.email)),
      this.invalidateListCache(),
    ]);


    return { message: `User #${id} deleted successfully` };
  }


  //helper
  private async invalidateListCache() {
  const keys = Array.from({ length: 100 }, (_, i) => LIST_KEY(i + 1));
  await this.redis.del(...keys);
  }
}