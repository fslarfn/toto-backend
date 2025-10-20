const bcrypt = require('bcryptjs');

async function hashDefaultPassword() {
  const plainPassword = 'pass123';
  const saltRounds = 10; // Jumlah salt rounds (10-12 cukup)
  console.log(`Password asli: ${plainPassword}`);
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    console.log(`Hash yang dihasilkan: ${hashedPassword}`);
    // Salin hash yang muncul di console
  } catch (error) {
    console.error("Error saat hashing password:", error);
  }
}

hashDefaultPassword();