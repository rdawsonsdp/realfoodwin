-- Seed the Real Food Win brand directory from the curated brand list.
-- Idempotent: upserts by lower(name) using the unique index defined in
-- 0004_content.sql. Re-running this updates category/description/website
-- without creating duplicates.

insert into public.brands (name, category, description, website_url) values
  ('Bearded Bros', 'Snacks', 'Organic, whole-food energy bars made with nothing but dates, nuts, and fruit. No added sugar, no soy, no dairy, no gluten — just real food fuel.', 'https://beardedbros.com'),
  ('Brodo', 'Pantry Staples', 'Slow-simmered, collagen-rich bone broth made from grass-fed and pasture-raised animals.', 'https://brodo.com'),
  ('Brooklyn Biltong', 'Meats', 'Air-dried, slow-cured beef biltong with no added sugar, nitrates, or preservatives.', 'https://brooklynbiltong.com'),
  ('Cob Foods', 'Snacks', 'Real food popcorn and corn snacks made with clean ingredients.', 'https://cobfoods.com'),
  ('Eden Foods', 'Pantry Staples', 'Organic beans, grains, pasta, and condiments in BPA-free packaging since 1968.', 'https://www.edenfoods.com'),
  ('Enso Chips', 'Snacks', 'Crunchy, better-for-you chips made with simple, recognizable ingredients.', 'https://ensochips.com'),
  ('Fichi Snacks', 'Snacks', 'Dried fig-based snacks packed with natural sweetness and whole-food nutrition.', 'https://fichisnacks.com'),
  ('Force of Nature', 'Meats', 'Regenerative beef, bison, elk, and venison raised with ancestral farming practices.', 'https://forceofnature.com'),
  ('Go Raw', 'Snacks', 'Certified organic, sprouted snacks and seeds with zero refined ingredients.', 'https://goraw.com'),
  ('Good Culture', 'Dairy', 'Cottage cheese and dairy products made from pasture-raised milk with live and active cultures.', 'https://goodculture.com'),
  ('Grass Roots Farmers Cooperative', 'Meats', 'Farmer-owned cooperative delivering 100% grass-fed, pasture-raised meats direct to your door.', 'https://grassrootscoop.com'),
  ('Honey Mama''s', 'Sweet Treats/Frozen', 'Raw cacao bars sweetened with honey, made from whole-food ingredients with no refined sugar.', 'https://honeymamas.com'),
  ('Ice Cream for Bears', 'Sweet Treats/Frozen', 'Cashew-based frozen desserts made with clean, plant-based ingredients and no dairy or junk.', 'https://icecreamforbears.com'),
  ('Jones Bar', 'Snacks', 'Simple, whole-food snack bars built for real nutrition on the go.', 'https://jonesbar.com'),
  ('Kraut Krackers', 'Snacks', 'Live-culture, fermented crackers loaded with probiotics for a healthy gut.', 'https://centralcoastlivefoods.com'),
  ('Lesser Evil', 'Snacks', 'Clean-ingredient popcorn and snacks made with avocado oil and no junky additives.', 'https://lesserevil.com'),
  ('Lineage Provisions', 'Meats', 'Thoughtfully sourced meats and provisions from farms committed to regenerative and humane animal husbandry.', 'https://lineageprovisions.com'),
  ('Lo Secco', 'Beverages', 'A clean, low-sugar prosecco alternative — a real food swap for conventional wine and sparkling beverages.', 'https://loseccoprosecco.com'),
  ('Mark''s', 'Snacks', 'Whole-food snacks made with simple, honest ingredients and no artificial anything.', 'https://markssnacks.com'),
  ('Masa', 'Snacks', 'Organic tortilla chips made with just three real ingredients — organic corn masa, oil, and salt. No GMOs, no seed oils, no preservatives.', 'https://masachips.com'),
  ('NUFS', 'Snacks', 'Nut-based snacks crafted from real, whole-food ingredients with no fillers.', 'https://getnufs.com'),
  ('Neo Bean Coffee', 'Beverages', 'A real food beverage brand offering clean, thoughtfully sourced coffee and immunity-boosting juices — no artificial flavors, no added junk.', 'https://neobeancoffee.com'),
  ('Nitschke Natural Beef', 'Meats', 'Family-raised natural beef with no hormones, no antibiotics, and no shortcuts — straight from the ranch to your table.', 'https://nnbeef.com'),
  ('Pasturebird', 'Meats', 'Pasture-raised chicken moved daily on fresh grass — the highest standard in poultry farming.', 'https://pasturebird.com'),
  ('Primal Pastures', 'Meats', 'Southern California farm raising 100% pasture-raised, beyond-organic chicken and pork.', 'https://primalpastures.com'),
  ('Roots Chips', 'Snacks', 'Real food chips made from simple, clean ingredients — no seed oils, no artificial flavors, just honest snacking.', 'https://rootschips.com'),
  ('Sourmilk', 'Dairy', 'Naturally fermented, probiotic-rich cultured dairy made with simple, clean ingredients.', 'https://sourmilk.com'),
  ('Teddie Peanut Butter', 'Pantry Staples', 'Old-fashioned peanut butter made with just peanuts and salt — nothing else.', 'https://teddie.com'),
  ('The Carnivore Bar', 'Snacks', 'Shelf-stable bars made from 100% animal-based ingredients — beef, suet, and salt. No plants, no fillers, just pure nose-to-tail nutrition.', 'https://carnivorebar.com'),
  ('The Conscious Bar', 'Sweet Treats/Frozen', 'Organic, date-sweetened chocolate bars made with simple whole-food ingredients and no refined sugar.', 'https://theconsciousbar.com'),
  ('The Hermit Calamari Jerky', 'Snacks', 'Wild-caught calamari jerky — a high-protein, ocean-sourced snack with no artificial ingredients.', 'https://thehermit.com'),
  ('The New Primal', 'Snacks', 'Clean meat sticks, jerky, and real-food condiments made without seed oils, added sugars, or artificial preservatives. Whole ingredients you can actually pronounce.', 'https://thenewprimal.com'),
  ('US Wellness Meats', 'Meats', 'Grass-fed and grass-finished beef, lamb, bison, and more from small family farms.', 'https://grasslandbeef.com'),
  ('Ultimaté', 'Beverages', 'A clean energy drink with real ingredients — a real food alternative to Red Bull, Monster, and other conventional caffeinated beverages.', 'https://drinkultimate.com'),
  ('Vital Choice', 'Seafood', 'Wild-caught Alaskan salmon, halibut, and seafood sustainably sourced from clean, cold waters.', 'https://vitalchoice.com'),
  ('Wild Planet Foods', 'Seafood', 'Sustainably caught tuna, sardines, and salmon with no added water, oil, or fillers.', 'https://wildplanetfoods.com'),
  ('Wild Zora', 'Snacks', 'Wild Zora makes 100% real food meat and veggie bars using simple, whole ingredients — no grains, no gluten, no dairy. Their bars combine grass-fed meats with organic vegetables and spices for a clean, paleo-friendly snack the whole family can enjoy.', 'https://wildzora.com'),
  ('Wildbrine', 'Pantry Staples', 'Raw, naturally fermented krauts, kimchis, and brines for probiotic-rich eating.', 'https://wildbrine.com')
on conflict ((lower(name))) do update set
  category    = excluded.category,
  description = excluded.description,
  website_url = excluded.website_url,
  updated_at  = now();
