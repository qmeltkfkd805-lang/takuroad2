import { createClient } from '@supabase/supabase-js'
import goodsTypes from '../data/seed/goods-types.json'
import amenities from '../data/seed/amenities.json'
import categories from '../data/seed/categories.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedGoodsTypes() {
  console.log('Seeding goods_types...')
  for (const item of goodsTypes) {
    const { error } = await supabase
      .from('goods_types')
      .upsert(
        { name: item.name, slug: item.slug, icon: item.icon, is_collectible: item.isCollectible },
        { onConflict: 'slug' }
      )
    if (error) console.error(`  ✗ ${item.name}:`, error.message)
    else console.log(`  ✓ ${item.name}`)
  }
}

async function seedAmenities() {
  console.log('Seeding shop_amenities...')
  for (const item of amenities) {
    const { error } = await supabase
      .from('shop_amenities')
      .upsert(
        { category: item.category, name: item.name, slug: item.slug, icon: item.icon },
        { onConflict: 'category,name' }
      )
    if (error) console.error(`  ✗ ${item.name}:`, error.message)
    else console.log(`  ✓ ${item.name}`)
  }
}

async function seedCategories() {
  console.log('Seeding categories...')
  for (const item of categories) {
    const { error } = await supabase
      .from('categories')
      .upsert(
        { name: item.name, slug: item.slug, icon: item.icon, color: item.color, bg_color: item.bgColor, sort_order: item.sortOrder },
        { onConflict: 'slug' }
      )
    if (error) console.error(`  ✗ ${item.name}:`, error.message)
    else console.log(`  ✓ ${item.name}`)
  }
}

async function main() {
  await seedGoodsTypes()
  await seedAmenities()
  await seedCategories()
  console.log('Done!')
}

main()