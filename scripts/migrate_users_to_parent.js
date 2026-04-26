// scripts/migrate_users_to_parent.js
//
// 用法:
//   node scripts/migrate_users_to_parent.js zhangsan@example.com lisi@example.com
//
// 把命令行里列出的用户名（已经在数据库里且 role=student）改成 role=parent。
// 不会动 password、displayName、conversation。原有数据全部保留。
//
// 安全特性:
//   - 只处理 role=student 的用户 (避免误改 teacher 帐号)
//   - 干跑模式: 加 --dry-run 参数只打印不改动
//   - 找不到的用户名会报告但不阻止其他迁移

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const usernames = args.filter(a => !a.startsWith('--'));

  if (usernames.length === 0) {
    console.error('用法: node scripts/migrate_users_to_parent.js [--dry-run] <username1> <username2> ...');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('错误: 没有设置 MONGODB_URI 环境变量');
    process.exit(1);
  }

  console.log(`连接数据库...${dryRun ? ' (干跑模式)' : ''}`);
  await mongoose.connect(uri);

  const userSchema = new mongoose.Schema({
    username: String,
    role: String
  }, { strict: false });
  const User = mongoose.model('User', userSchema);

  console.log(`\n将处理 ${usernames.length} 个用户名:\n`);

  let success = 0, skipped = 0, notFound = 0;

  for (const username of usernames) {
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`  ✗ 找不到用户: ${username}`);
      notFound++;
      continue;
    }
    if (user.role === 'parent') {
      console.log(`  → 已经是 parent: ${username} (跳过)`);
      skipped++;
      continue;
    }
    if (user.role === 'teacher') {
      console.log(`  ⚠ 是 teacher 帐号，不能转换: ${username} (跳过)`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  [DRY] 会把 ${username} 从 ${user.role} 改成 parent`);
    } else {
      user.role = 'parent';
      await user.save();
      console.log(`  ✓ ${username}: ${user.role === 'parent' ? 'student → parent' : 'unknown error'}`);
    }
    success++;
  }

  console.log(`\n汇总:`);
  console.log(`  成功: ${success} ${dryRun ? '(将执行)' : ''}`);
  console.log(`  跳过: ${skipped}`);
  console.log(`  未找到: ${notFound}`);
  console.log('');

  await mongoose.disconnect();
  console.log('完成。');
}

main().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
