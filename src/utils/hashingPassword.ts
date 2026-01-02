import * as bcrypt from 'bcrypt';

export async function hashingPassword(psw: string) {
  const saltOrRounds = 10;
  const hash = await bcrypt.hash(psw, saltOrRounds);
  return hash;
}
