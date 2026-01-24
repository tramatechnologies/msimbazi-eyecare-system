-- Migration: Providers, Medications, and ICD-10 Codes
-- Run in Supabase SQL Editor or via: psql ... -f 004_providers_medications_icd10.sql
-- Replaces mock data with real database tables

-- =============================================================================
-- 1. Providers Table (Doctors/Optometrists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('OPTOMETRIST', 'OPHTHALMOLOGIST', 'PHARMACIST', 'OPTICAL_DISPENSER')),
  specialization VARCHAR(255),
  is_nhif_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'ON_BREAK', 'OFFLINE')),
  queue_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_role ON providers(role);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_is_nhif_verified ON providers(is_nhif_verified);

-- =============================================================================
-- 2. Medications Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  form VARCHAR(50) NOT NULL CHECK (form IN ('Drops', 'Tablet', 'Capsule', 'Ointment', 'Injection', 'Other')),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_covered_by_nhif BOOLEAN DEFAULT FALSE,
  is_covered_by_private BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_form ON medications(form);
CREATE INDEX IF NOT EXISTS idx_medications_is_active ON medications(is_active);
CREATE INDEX IF NOT EXISTS idx_medications_is_covered_by_nhif ON medications(is_covered_by_nhif);

-- =============================================================================
-- 3. ICD-10 Codes Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS icd10_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icd10_codes_code ON icd10_codes(code);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_category ON icd10_codes(category);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_is_active ON icd10_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description ON icd10_codes USING gin(to_tsvector('english', description));

-- =============================================================================
-- 4. Insert Common ICD-10 Eye Codes
-- =============================================================================
INSERT INTO icd10_codes (code, description, category) VALUES
  -- Disorders of Eyelid (H00-H05)
  ('H00.0', 'Hordeolum externum (Stye)', 'Disorders of Eyelid'),
  ('H00.1', 'Hordeolum internum', 'Disorders of Eyelid'),
  ('H01.0', 'Blepharitis', 'Disorders of Eyelid'),
  ('H01.1', 'Noninfectious dermatoses of eyelid', 'Disorders of Eyelid'),
  ('H02.0', 'Entropion and trichiasis of eyelid', 'Disorders of Eyelid'),
  ('H02.1', 'Ectropion of eyelid', 'Disorders of Eyelid'),
  ('H02.2', 'Lagophthalmos', 'Disorders of Eyelid'),
  ('H02.3', 'Blepharochalasis', 'Disorders of Eyelid'),
  ('H02.4', 'Ptosis of eyelid', 'Disorders of Eyelid'),
  ('H02.5', 'Other disorders affecting eyelid function', 'Disorders of Eyelid'),
  ('H02.6', 'Xanthelasma of eyelid', 'Disorders of Eyelid'),
  ('H02.7', 'Other degenerative disorders of eyelid', 'Disorders of Eyelid'),
  ('H03.0', 'Parasitic infestation of eyelid', 'Disorders of Eyelid'),
  ('H03.1', 'Involvement of eyelid in other infectious diseases', 'Disorders of Eyelid'),
  ('H04.0', 'Dacryoadenitis', 'Disorders of Lacrimal System'),
  ('H04.1', 'Other disorders of lacrimal gland', 'Disorders of Lacrimal System'),
  ('H04.2', 'Epiphora', 'Disorders of Lacrimal System'),
  ('H04.3', 'Acute and unspecified inflammation of lacrimal passages', 'Disorders of Lacrimal System'),
  ('H04.4', 'Chronic inflammation of lacrimal passages', 'Disorders of Lacrimal System'),
  ('H04.5', 'Stenosis and insufficiency of lacrimal passages', 'Disorders of Lacrimal System'),
  ('H04.6', 'Other changes in lacrimal passages', 'Disorders of Lacrimal System'),
  ('H05.0', 'Acute inflammation of orbit', 'Disorders of Orbit'),
  ('H05.1', 'Chronic inflammatory disorders of orbit', 'Disorders of Orbit'),
  ('H05.2', 'Exophthalmic conditions', 'Disorders of Orbit'),
  ('H05.3', 'Deformity of orbit', 'Disorders of Orbit'),
  ('H05.4', 'Enophthalmos', 'Disorders of Orbit'),
  ('H05.5', 'Retained foreign body in orbit', 'Disorders of Orbit'),
  
  -- Disorders of Conjunctiva (H10-H11)
  ('H10.0', 'Mucopurulent conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.1', 'Acute atopic conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.2', 'Other acute conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.3', 'Unspecified acute conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.4', 'Chronic conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.5', 'Blepharoconjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.8', 'Other conjunctivitis', 'Disorders of Conjunctiva'),
  ('H10.9', 'Unspecified conjunctivitis', 'Disorders of Conjunctiva'),
  ('H11.0', 'Pterygium', 'Disorders of Conjunctiva'),
  ('H11.1', 'Conjunctival degenerations and deposits', 'Disorders of Conjunctiva'),
  ('H11.2', 'Conjunctival scars', 'Disorders of Conjunctiva'),
  ('H11.3', 'Conjunctival hemorrhage', 'Disorders of Conjunctiva'),
  ('H11.4', 'Other conjunctival vascular disorders', 'Disorders of Conjunctiva'),
  ('H11.8', 'Other specified disorders of conjunctiva', 'Disorders of Conjunctiva'),
  ('H11.9', 'Unspecified disorder of conjunctiva', 'Disorders of Conjunctiva'),
  
  -- Disorders of Sclera, Cornea, Iris and Ciliary Body (H15-H22)
  ('H15.0', 'Scleritis', 'Disorders of Sclera'),
  ('H15.1', 'Episcleritis', 'Disorders of Sclera'),
  ('H16.0', 'Corneal ulcer', 'Disorders of Cornea'),
  ('H16.1', 'Superficial keratitis', 'Disorders of Cornea'),
  ('H16.2', 'Keratoconjunctivitis', 'Disorders of Cornea'),
  ('H16.3', 'Interstitial and deep keratitis', 'Disorders of Cornea'),
  ('H16.4', 'Neovascularization of cornea', 'Disorders of Cornea'),
  ('H16.8', 'Other keratitis', 'Disorders of Cornea'),
  ('H16.9', 'Unspecified keratitis', 'Disorders of Cornea'),
  ('H17.0', 'Adherent leukoma', 'Disorders of Cornea'),
  ('H17.1', 'Other central corneal opacity', 'Disorders of Cornea'),
  ('H17.8', 'Other corneal scars and opacities', 'Disorders of Cornea'),
  ('H17.9', 'Unspecified corneal scar and opacity', 'Disorders of Cornea'),
  ('H18.0', 'Pigmentations and deposits in cornea', 'Disorders of Cornea'),
  ('H18.1', 'Bullous keratopathy', 'Disorders of Cornea'),
  ('H18.2', 'Other corneal edema', 'Disorders of Cornea'),
  ('H18.3', 'Changes in corneal membranes', 'Disorders of Cornea'),
  ('H18.4', 'Corneal degeneration', 'Disorders of Cornea'),
  ('H18.5', 'Hereditary corneal dystrophies', 'Disorders of Cornea'),
  ('H18.6', 'Keratoconus', 'Disorders of Cornea'),
  ('H18.7', 'Other corneal deformities', 'Disorders of Cornea'),
  ('H18.8', 'Other specified disorders of cornea', 'Disorders of Cornea'),
  ('H18.9', 'Unspecified disorder of cornea', 'Disorders of Cornea'),
  ('H20.0', 'Acute and subacute iridocyclitis', 'Disorders of Iris and Ciliary Body'),
  ('H20.1', 'Chronic iridocyclitis', 'Disorders of Iris and Ciliary Body'),
  ('H20.2', 'Lens-induced iridocyclitis', 'Disorders of Iris and Ciliary Body'),
  ('H20.8', 'Other iridocyclitis', 'Disorders of Iris and Ciliary Body'),
  ('H20.9', 'Unspecified iridocyclitis', 'Disorders of Iris and Ciliary Body'),
  ('H21.0', 'Hyphema', 'Disorders of Iris and Ciliary Body'),
  ('H21.1', 'Other vascular disorders of iris and ciliary body', 'Disorders of Iris and Ciliary Body'),
  ('H21.2', 'Degeneration of iris and ciliary body', 'Disorders of Iris and Ciliary Body'),
  ('H21.3', 'Cyst of iris, ciliary body and anterior chamber', 'Disorders of Iris and Ciliary Body'),
  ('H21.4', 'Pupillary membranes', 'Disorders of Iris and Ciliary Body'),
  ('H21.5', 'Other adhesions and disruptions of iris and ciliary body', 'Disorders of Iris and Ciliary Body'),
  ('H21.8', 'Other specified disorders of iris and ciliary body', 'Disorders of Iris and Ciliary Body'),
  ('H21.9', 'Unspecified disorder of iris and ciliary body', 'Disorders of Iris and Ciliary Body'),
  ('H22.0', 'Iridocyclitis in infectious and parasitic diseases', 'Disorders of Iris and Ciliary Body'),
  ('H22.1', 'Iridocyclitis in other diseases', 'Disorders of Iris and Ciliary Body'),
  ('H22.8', 'Other disorders of iris and ciliary body in diseases', 'Disorders of Iris and Ciliary Body'),
  
  -- Disorders of Lens (H25-H28)
  ('H25.0', 'Age-related incipient cataract', 'Disorders of Lens'),
  ('H25.1', 'Age-related nuclear cataract', 'Disorders of Lens'),
  ('H25.2', 'Age-related cataract, morgagnian type', 'Disorders of Lens'),
  ('H25.8', 'Other age-related cataract', 'Disorders of Lens'),
  ('H25.9', 'Unspecified age-related cataract', 'Disorders of Lens'),
  ('H26.0', 'Infantile, juvenile and presenile cataract', 'Disorders of Lens'),
  ('H26.1', 'Traumatic cataract', 'Disorders of Lens'),
  ('H26.2', 'Complicated cataract', 'Disorders of Lens'),
  ('H26.3', 'Drug-induced cataract', 'Disorders of Lens'),
  ('H26.4', 'Secondary cataract', 'Disorders of Lens'),
  ('H26.8', 'Other specified cataract', 'Disorders of Lens'),
  ('H26.9', 'Unspecified cataract', 'Disorders of Lens'),
  ('H27.0', 'Aphakia', 'Disorders of Lens'),
  ('H27.1', 'Dislocation of lens', 'Disorders of Lens'),
  ('H27.8', 'Other specified disorders of lens', 'Disorders of Lens'),
  ('H27.9', 'Unspecified disorder of lens', 'Disorders of Lens'),
  ('H28.0', 'Diabetic cataract', 'Disorders of Lens'),
  ('H28.1', 'Cataract in other endocrine, nutritional and metabolic diseases', 'Disorders of Lens'),
  ('H28.2', 'Cataract in other diseases', 'Disorders of Lens'),
  
  -- Disorders of Vitreous Body and Globe (H43-H44)
  ('H43.0', 'Vitreous prolapse', 'Disorders of Vitreous Body'),
  ('H43.1', 'Vitreous hemorrhage', 'Disorders of Vitreous Body'),
  ('H43.2', 'Crystalline deposits in vitreous body', 'Disorders of Vitreous Body'),
  ('H43.3', 'Other vitreous opacities', 'Disorders of Vitreous Body'),
  ('H43.8', 'Other disorders of vitreous body', 'Disorders of Vitreous Body'),
  ('H43.9', 'Unspecified disorder of vitreous body', 'Disorders of Vitreous Body'),
  ('H44.0', 'Purulent endophthalmitis', 'Disorders of Globe'),
  ('H44.1', 'Other endophthalmitis', 'Disorders of Globe'),
  ('H44.2', 'Degenerative myopia', 'Disorders of Globe'),
  ('H44.3', 'Other degenerative disorders of globe', 'Disorders of Globe'),
  ('H44.4', 'Hypotony of eye', 'Disorders of Globe'),
  ('H44.5', 'Degenerated conditions of globe', 'Disorders of Globe'),
  ('H44.6', 'Retained intraocular foreign body', 'Disorders of Globe'),
  ('H44.7', 'Other disorders of globe', 'Disorders of Globe'),
  
  -- Disorders of Retina (H30-H36)
  ('H30.0', 'Focal chorioretinal inflammation', 'Disorders of Retina'),
  ('H30.1', 'Disseminated chorioretinal inflammation', 'Disorders of Retina'),
  ('H30.2', 'Posterior cyclitis', 'Disorders of Retina'),
  ('H30.8', 'Other chorioretinal inflammation', 'Disorders of Retina'),
  ('H30.9', 'Unspecified chorioretinal inflammation', 'Disorders of Retina'),
  ('H31.0', 'Chorioretinal scars', 'Disorders of Retina'),
  ('H31.1', 'Choroidal degeneration', 'Disorders of Retina'),
  ('H31.2', 'Hereditary choroidal dystrophy', 'Disorders of Retina'),
  ('H31.3', 'Choroidal hemorrhage and rupture', 'Disorders of Retina'),
  ('H31.4', 'Choroidal detachment', 'Disorders of Retina'),
  ('H31.8', 'Other specified disorders of choroid', 'Disorders of Retina'),
  ('H31.9', 'Unspecified disorder of choroid', 'Disorders of Retina'),
  ('H33.0', 'Retinal detachment with retinal break', 'Disorders of Retina'),
  ('H33.1', 'Retinoschisis and retinal cysts', 'Disorders of Retina'),
  ('H33.2', 'Serous retinal detachment', 'Disorders of Retina'),
  ('H33.3', 'Retinal breaks without detachment', 'Disorders of Retina'),
  ('H33.4', 'Traction detachment of retina', 'Disorders of Retina'),
  ('H33.5', 'Other retinal detachments', 'Disorders of Retina'),
  ('H34.0', 'Transient retinal artery occlusion', 'Disorders of Retina'),
  ('H34.1', 'Central retinal artery occlusion', 'Disorders of Retina'),
  ('H34.2', 'Other retinal artery occlusions', 'Disorders of Retina'),
  ('H34.8', 'Other retinal vascular occlusions', 'Disorders of Retina'),
  ('H34.9', 'Unspecified retinal vascular occlusion', 'Disorders of Retina'),
  ('H35.0', 'Background retinopathy and retinal vascular changes', 'Disorders of Retina'),
  ('H35.1', 'Retinopathy of prematurity', 'Disorders of Retina'),
  ('H35.2', 'Other proliferative retinopathy', 'Disorders of Retina'),
  ('H35.3', 'Degeneration of macula and posterior pole', 'Disorders of Retina'),
  ('H35.4', 'Peripheral retinal degeneration', 'Disorders of Retina'),
  ('H35.5', 'Hereditary retinal dystrophy', 'Disorders of Retina'),
  ('H35.6', 'Retinal hemorrhage', 'Disorders of Retina'),
  ('H35.7', 'Separation of retinal layers', 'Disorders of Retina'),
  ('H35.8', 'Other specified retinal disorders', 'Disorders of Retina'),
  ('H35.9', 'Unspecified retinal disorder', 'Disorders of Retina'),
  ('H36.0', 'Diabetic retinopathy', 'Disorders of Retina'),
  
  -- Disorders of Optic Nerve and Visual Pathways (H46-H47)
  ('H46.0', 'Optic neuritis', 'Disorders of Optic Nerve'),
  ('H46.1', 'Optic disc swelling', 'Disorders of Optic Nerve'),
  ('H46.2', 'Optic atrophy', 'Disorders of Optic Nerve'),
  ('H46.3', 'Other disorders of optic disc', 'Disorders of Optic Nerve'),
  ('H46.4', 'Optic chiasm disorders', 'Disorders of Optic Nerve'),
  ('H46.8', 'Other disorders of optic nerve and visual pathways', 'Disorders of Optic Nerve'),
  ('H46.9', 'Unspecified disorder of optic nerve and visual pathways', 'Disorders of Optic Nerve'),
  ('H47.0', 'Disorders of optic nerve in diseases', 'Disorders of Optic Nerve'),
  ('H47.1', 'Optic disc edema', 'Disorders of Optic Nerve'),
  ('H47.2', 'Optic atrophy in diseases', 'Disorders of Optic Nerve'),
  ('H47.3', 'Other disorders of optic nerve in diseases', 'Disorders of Optic Nerve'),
  
  -- Disorders of Ocular Muscles, Binocular Movement, Accommodation and Refraction (H49-H52)
  ('H49.0', 'Third nerve palsy', 'Disorders of Ocular Muscles'),
  ('H49.1', 'Fourth nerve palsy', 'Disorders of Ocular Muscles'),
  ('H49.2', 'Sixth nerve palsy', 'Disorders of Ocular Muscles'),
  ('H49.3', 'Total ophthalmoplegia', 'Disorders of Ocular Muscles'),
  ('H49.4', 'Progressive external ophthalmoplegia', 'Disorders of Ocular Muscles'),
  ('H49.8', 'Other paralytic strabismus', 'Disorders of Ocular Muscles'),
  ('H49.9', 'Unspecified paralytic strabismus', 'Disorders of Ocular Muscles'),
  ('H50.0', 'Convergent concomitant strabismus', 'Disorders of Ocular Muscles'),
  ('H50.1', 'Divergent concomitant strabismus', 'Disorders of Ocular Muscles'),
  ('H50.2', 'Vertical strabismus', 'Disorders of Ocular Muscles'),
  ('H50.3', 'Intermittent heterotropia', 'Disorders of Ocular Muscles'),
  ('H50.4', 'Other and unspecified heterotropia', 'Disorders of Ocular Muscles'),
  ('H50.5', 'Heterophoria', 'Disorders of Ocular Muscles'),
  ('H50.6', 'Mechanical strabismus', 'Disorders of Ocular Muscles'),
  ('H50.8', 'Other specified strabismus', 'Disorders of Ocular Muscles'),
  ('H50.9', 'Unspecified strabismus', 'Disorders of Ocular Muscles'),
  ('H51.0', 'Palsy of accommodation', 'Disorders of Accommodation'),
  ('H51.1', 'Accommodative insufficiency', 'Disorders of Accommodation'),
  ('H51.2', 'Accommodative spasm', 'Disorders of Accommodation'),
  ('H51.8', 'Other disorders of accommodation', 'Disorders of Accommodation'),
  ('H51.9', 'Unspecified disorder of accommodation', 'Disorders of Accommodation'),
  ('H52.0', 'Hypermetropia', 'Disorders of Refraction'),
  ('H52.1', 'Myopia', 'Disorders of Refraction'),
  ('H52.2', 'Astigmatism', 'Disorders of Refraction'),
  ('H52.3', 'Anisometropia and aniseikonia', 'Disorders of Refraction'),
  ('H52.4', 'Presbyopia', 'Disorders of Refraction'),
  ('H52.5', 'Disorders of accommodation', 'Disorders of Refraction'),
  ('H52.6', 'Other disorders of refraction', 'Disorders of Refraction'),
  ('H52.7', 'Unspecified disorder of refraction', 'Disorders of Refraction'),
  
  -- Visual Disturbances and Blindness (H53-H54)
  ('H53.0', 'Amblyopia ex anopsia', 'Visual Disturbances'),
  ('H53.1', 'Subjective visual disturbances', 'Visual Disturbances'),
  ('H53.2', 'Diplopia', 'Visual Disturbances'),
  ('H53.3', 'Other disorders of binocular vision', 'Visual Disturbances'),
  ('H53.4', 'Visual field defects', 'Visual Disturbances'),
  ('H53.5', 'Color vision deficiencies', 'Visual Disturbances'),
  ('H53.6', 'Night blindness', 'Visual Disturbances'),
  ('H53.8', 'Other visual disturbances', 'Visual Disturbances'),
  ('H53.9', 'Unspecified visual disturbance', 'Visual Disturbances'),
  ('H54.0', 'Blindness, both eyes', 'Blindness'),
  ('H54.1', 'Blindness, one eye, low vision other eye', 'Blindness'),
  ('H54.2', 'Blindness, one eye', 'Blindness'),
  ('H54.3', 'Unqualified visual loss, both eyes', 'Blindness'),
  ('H54.4', 'Unqualified visual loss, one eye', 'Blindness'),
  ('H54.5', 'Low vision, both eyes', 'Blindness'),
  ('H54.6', 'Low vision, one eye', 'Blindness'),
  ('H54.7', 'Unspecified visual loss', 'Blindness')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 5. Insert Sample Medications (can be updated via admin interface)
-- =============================================================================
-- Note: Medications should be inserted via admin interface, but we'll add a few common ones
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM medications WHERE name = 'Atropine Sulfate 1%') THEN
    INSERT INTO medications (name, dosage, form, price, stock, is_covered_by_nhif, is_covered_by_private) VALUES
      ('Atropine Sulfate 1%', '10ml', 'Drops', 15000, 45, true, true),
      ('Timolol Maleate 0.5%', '5ml', 'Drops', 12000, 30, true, true),
      ('Ofloxacin 0.3%', '5ml', 'Drops', 18000, 12, false, true),
      ('Prednisolone Acetate 1%', '5ml', 'Drops', 22000, 8, true, true),
      ('Ciprofloxacin', '500mg', 'Tablet', 8000, 100, true, true),
      ('Eye Lubricant (Artificial Tears)', '15ml', 'Drops', 25000, 50, false, false);
  END IF;
END $$;

-- =============================================================================
-- 6. RLS Policies
-- =============================================================================

-- Providers: All authenticated users can read, only admins can write
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers are viewable by authenticated users"
  ON providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Providers are insertable by admins"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );

CREATE POLICY "Providers are updatable by admins"
  ON providers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );

-- Medications: All authenticated users can read, only admins can write
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medications are viewable by authenticated users"
  ON medications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Medications are insertable by admins"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );

CREATE POLICY "Medications are updatable by admins"
  ON medications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );

-- ICD-10 Codes: All authenticated users can read, only admins can write
ALTER TABLE icd10_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ICD-10 codes are viewable by authenticated users"
  ON icd10_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ICD-10 codes are insertable by admins"
  ON icd10_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );

CREATE POLICY "ICD-10 codes are updatable by admins"
  ON icd10_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'clinic_manager')
    )
  );
