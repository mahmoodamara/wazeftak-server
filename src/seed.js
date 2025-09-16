// src/seed.js
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { MONGO_URI, MONGO_DBNAME } = require('./config/env');

// Models
const User = require('./models/User');
const Company = require('./models/Company');
const Job = require('./models/Job');
const Taxonomy = require('./models/Taxonomy');

(async () => {
  try {
    await connectDB();

    console.log('🚀 Running seed script...');

    // ====== 1. Admin User ======
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123'; // غيّرها في الإنتاج
    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      admin = await User.create({
        role: 'admin',
        name: 'System Admin',
        email: adminEmail,
        passwordHash,
        locale: 'ar'
      });
      console.log(`✅ Created admin user: ${admin.email} / ${adminPassword}`);
    } else {
      console.log(`ℹ️ Admin user already exists: ${admin.email}`);
    }

    // ====== 2. Company Owner User ======
    const companyEmail = 'company@example.com';
    const companyPassword = 'company123';
    let companyOwner = await User.findOne({ email: companyEmail });

    if (!companyOwner) {
      const passwordHash = await bcrypt.hash(companyPassword, 10);
      companyOwner = await User.create({
        role: 'company',
        name: 'Demo Company Owner',
        email: companyEmail,
        passwordHash,
        locale: 'ar'
      });
      console.log(`✅ Created company owner: ${companyOwner.email} / ${companyPassword}`);
    } else {
      console.log(`ℹ️ Company owner already exists: ${companyOwner.email}`);
    }

    // ====== 3. Company ======
    let company = await Company.findOne({ ownerId: companyOwner._id });
    if (!company) {
      company = await Company.create({
        ownerId: companyOwner._id,
        name: 'Demo Company Ltd',
        city: 'حيفا',
        about: 'شركة تجريبية لتجربة المنصة.',
        contactEmail: companyOwner.email,
        verified: true,
        status: 'active'
      });
      console.log(`✅ Created company: ${company.name}`);
    } else {
      console.log(`ℹ️ Company already exists: ${company.name}`);
    }

    // ====== 4. Job ======
    let job = await Job.findOne({ companyId: company._id, title: 'مطور React Native' });
    if (!job) {
      job = await Job.create({
        companyId: company._id,
        title: 'مطور React Native',
        description: 'مطلوب مطور React Native للعمل على تطبيقات موبايل حديثة.',
        city: 'حيفا',
        jobTypeSlug: 'full_time',
        fieldSlugs: ['it'],
        skillSlugs: ['javascript'],
        seniority: 'junior',
        isApproved: true,
        status: 'open'
      });
      console.log(`✅ Created demo job: ${job.title}`);
    } else {
      console.log(`ℹ️ Demo job already exists: ${job.title}`);
    }

    // ====== 5. Taxonomies ======
    const seedTaxonomies = [
      { type: 'city', slug: 'haifa', label: { ar: 'حيفا', he: 'חיפה' } },
      { type: 'city', slug: 'nablus', label: { ar: 'نابلس', he: 'שכם' } },
      { type: 'city', slug: 'jerusalem', label: { ar: 'القدس', he: 'ירושלים' } },

      { type: 'field', slug: 'it', label: { ar: 'تقنية المعلومات', he: 'היי-טק' } },
      { type: 'field', slug: 'education', label: { ar: 'التعليم', he: 'חינוך' } },
      { type: 'field', slug: 'health', label: { ar: 'الصحة', he: 'בריאות' } },

      { type: 'skill', slug: 'javascript', label: { ar: 'جافاسكربت', he: 'JavaScript' } },
      { type: 'skill', slug: 'python', label: { ar: 'بايثون', he: 'Python' } },
      { type: 'skill', slug: 'teaching', label: { ar: 'التدريس', he: 'הוראה' } },

      { type: 'job_type', slug: 'full_time', label: { ar: 'دوام كامل', he: 'משרה מלאה' } },
      { type: 'job_type', slug: 'part_time', label: { ar: 'دوام جزئي', he: 'משרה חלקית' } },
      { type: 'job_type', slug: 'remote', label: { ar: 'عن بُعد', he: 'עבודה מרחוק' } },

      { type: 'seniority', slug: 'junior', label: { ar: 'مبتدئ', he: 'ג\'וניור' } },
      { type: 'seniority', slug: 'mid', label: { ar: 'متوسط', he: 'מיד' } },
      { type: 'seniority', slug: 'senior', label: { ar: 'خبير', he: 'סיניור' } },
    ];

    for (const t of seedTaxonomies) {
      await Taxonomy.updateOne(
        { type: t.type, slug: t.slug },
        { $setOnInsert: { ...t, active: true, order: 1 } },
        { upsert: true }
      );
    }
    console.log('✅ Seeded base taxonomies');

    console.log('🎉 Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
})();
