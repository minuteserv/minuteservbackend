require('dotenv').config();
const supabase = require('../config/supabase');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Seed services from JSON file
 * This script reads from the frontend services.json file
 */
async function seedServicesFromJson() {
  try {
    logger.info('🌱 Starting services seed from JSON...');

    // Read services.json from parent directory
    const jsonPath = path.join(__dirname, '../../../src/data/services.json');
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Services JSON file not found at: ${jsonPath}`);
    }

    const servicesData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    logger.info('✅ Services JSON loaded');

    const allServices = [];

    // Handle different JSON structures
    // Structure 1: { "tiers": [{ "tier": "Minimal", "categories": [...] }] }
    // Structure 2: { "Minimal": { "Clean up": [...] } }
    
    if (servicesData.tiers && Array.isArray(servicesData.tiers)) {
      // New structure with tiers array
      servicesData.tiers.forEach(tierObj => {
        const tier = tierObj.tier;
        if (tierObj.categories && Array.isArray(tierObj.categories)) {
          tierObj.categories.forEach(categoryObj => {
            const category = categoryObj.category;
            if (categoryObj.items && Array.isArray(categoryObj.items)) {
              categoryObj.items.forEach(service => {
                // Skip services with no productCost
                if (!service.productCost && service.productCost !== 0) {
                  logger.debug(`⏭️  Skipping ${service.name} - no productCost`);
                  return;
                }

                allServices.push({
                  name: service.name || `${category} - ${tier}`,
                  category: category,
                  tier: tier,
                  brand: service.brand || null,
                  product_cost: parseFloat(service.productCost || 0),
                  market_price: service.marketPrice ? parseFloat(service.marketPrice) : null,
                  duration_minutes: service.durationMinutes || 60,
                  image_url: service.image || null,
                  is_active: true
                });
              });
            }
          });
        }
      });
    } else {
      // Old structure: { "Minimal": { "Clean up": [...] } }
      Object.keys(servicesData).forEach(tier => {
        if (tier !== 'currency' && tier !== 'tiers') {
          Object.keys(servicesData[tier]).forEach(serviceType => {
            const services = servicesData[tier][serviceType];
            
            if (Array.isArray(services)) {
              services.forEach(service => {
                allServices.push({
                  name: service.name || `${serviceType} - ${tier}`,
                  category: service.category || serviceType,
                  tier: tier,
                  brand: service.brand || null,
                  product_cost: parseFloat(service.productCost || service.price || 0),
                  market_price: service.marketPrice ? parseFloat(service.marketPrice) : null,
                  duration_minutes: service.duration || service.durationMinutes || 60,
                  image_url: service.image || null,
                  is_active: true
                });
              });
            }
          });
        }
      });
    }

    logger.info(`📦 Found ${allServices.length} services to seed`);

    if (allServices.length === 0) {
      logger.warn('⚠️  No services found in JSON file');
      return { inserted: 0, skipped: 0, total: 0 };
    }

    // Insert services in batches
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const service of allServices) {
      try {
        // Check if service already exists
        const { data: existing } = await supabase
          .from('services')
          .select('id')
          .eq('name', service.name)
          .eq('tier', service.tier)
          .eq('category', service.category)
          .single();

        if (!existing) {
          const { error } = await supabase
            .from('services')
            .insert(service);

          if (error) {
            logger.error(`❌ Error inserting ${service.name}:`, error.message);
            errors++;
          } else {
            inserted++;
            logger.debug(`✅ Inserted: ${service.name}`);
          }
        } else {
          skipped++;
          logger.debug(`⏭️  Skipped (exists): ${service.name}`);
        }
      } catch (error) {
        logger.error(`❌ Error processing ${service.name}:`, error.message);
        errors++;
      }
    }

    logger.info('✅ Services seed completed!');
    logger.info(`   📊 Inserted: ${inserted}`);
    logger.info(`   ⏭️  Skipped: ${skipped}`);
    logger.info(`   ❌ Errors: ${errors}`);
    logger.info(`   📦 Total: ${allServices.length}`);

    return { inserted, skipped, errors, total: allServices.length };
  } catch (error) {
    logger.error('❌ Seed services error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  
  seedServicesFromJson()
    .then((result) => {
      console.log('\n✅ Seed completed successfully!');
      console.log('📊 Results:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error.message);
      process.exit(1);
    });
}

module.exports = { seedServicesFromJson };

