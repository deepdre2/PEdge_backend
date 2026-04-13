import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  Query,
  DefaultValuePipe 
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/user/decorators/roles.decorators';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)  
export class UserController {
  constructor(private readonly userService: UserService) {}

 // all routes admin only
  @Get()
  @Roles('admin')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.userService.findAll(page, limit);
  }

  // search by email
    @Get('search')
    @Roles('admin')
    search(@Query('email') email: string) {
      if (!email) return [];
      return this.userService.searchByEmail(email);
    }

  // get /users/:id -> one user 
  @Get(':id')
  @Roles('admin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  // post /users -> create a user
  @Post()
  @Roles('admin')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.adminCreateUser(createUserDto);
  }

  // Delete /users/:id > delete a user
  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  //roles for both

  // patch /users/:id  admin can edit anyone user only himself  
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const requestingUser = req.user;   

    // regular users can only update their own profile
    if (requestingUser.role !== 'admin' && requestingUser.sub !== id) {
      throw new ForbiddenException('You can only edit your own profile');
    }

    // regular users cannot change their own role
    if (requestingUser.role !== 'admin' && updateUserDto.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    return this.userService.update(id, updateUserDto);
  }
}