const supabase = require('../config/supabase');
const servicesData = require('../../src/data/services.json');
const logger = require('./logger');

/**
 * Seed services from JSON data
 * Run this once to populate services table
 */
async function seedServices() {
  try {
    logger.info('Starting services seed...');

    // Flatten the nested JSON structure
    const allServices = [];

    // Iterate through tiers
    Object.keys(servicesData).forEach(tier => {
      // Iterate through service types
      Object.keys(servicesData[tier]).forEach(serviceType => {
        const services = servicesData[tier][serviceType];
        
        // Iterate through services in this type
        services.forEach(service => {
          allServices.push({
            name: service.name || `${serviceType} - ${tier}`,
            category: service.category || serviceType,
            tier: tier,
            product_cost: parseFloat(service.productCost || service.price || 0),
            market_price: service.marketPrice ? parseFloat(service.marketPrice) : null,
            duration_minutes: service.duration || 60,
            image_url: service.image || null,
            is_active: true
          });
        });
      });
    });

    logger.info(`Found ${allServices.length} services to seed`);

    // Insert services (skip duplicates)
    let inserted = 0;
    let skipped = 0;

    for (const service of allServices) {
      const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('name', service.name)
        .eq('tier', service.tier)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('services')
          .insert(service);

        if (error) {
          logger.error(`Error inserting ${service.name}:`, error);
        } else {
          inserted++;
        }
      } else {
        skipped++;
      }
    }

    logger.info(`✅ Services seeded: ${inserted} inserted, ${skipped} skipped`);
    return { inserted, skipped, total: allServices.length };
  } catch (error) {
    logger.error('Seed services error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedServices()
    .then((result) => {
      console.log('✅ Seed completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedServices };

