-- Run this once in phpMyAdmin after selecting ip_std6730202602.
-- Back up the employees table first. This renames existing columns and keeps
-- the employee rows and primary-key definition.
ALTER TABLE `employees`
  CHANGE COLUMN `id` `CharuesaSuksahwang_id` INT NOT NULL,
  CHANGE COLUMN `name` `CharuesaSuksahwang_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  CHANGE COLUMN `position` `CharuesaSuksahwang_position` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  CHANGE COLUMN `status` `CharuesaSuksahwang_status` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  CHANGE COLUMN `salary` `CharuesaSuksahwang_salary` INT NOT NULL;
