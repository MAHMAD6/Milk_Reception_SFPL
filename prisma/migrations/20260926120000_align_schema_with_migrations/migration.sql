-- Aligns the migrated database with prisma/schema.prisma so `prisma migrate diff`
-- reports no drift and future `prisma migrate dev` runs do not emit surprise changes.
--
-- Behaviour-neutral: constraint/index renames to Prisma's canonical names, foreign keys
-- re-created with ON UPDATE CASCADE (primary keys are never updated, ON DELETE rules are
-- unchanged), redundant DB-side updated_at defaults dropped (Prisma sets @updatedAt), and
-- lab_test_assignment.assigned_at widened to TIMESTAMP(6) like every other timestamp.

-- DropForeignKey
ALTER TABLE "mot_shop_collection" DROP CONSTRAINT IF EXISTS "mot_shop_collection_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_recipient_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_delivery" DROP CONSTRAINT IF EXISTS "notification_delivery_notification_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_preference" DROP CONSTRAINT IF EXISTS "notification_preference_user_id_fkey";

-- DropForeignKey
ALTER TABLE "push_subscription" DROP CONSTRAINT IF EXISTS "push_subscription_user_id_fkey";

-- DropForeignKey
ALTER TABLE "vehicle_visit" DROP CONSTRAINT IF EXISTS "vehicle_visit_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_local_supplier_arrival" DROP CONSTRAINT IF EXISTS "zmcc_local_supplier_arrival_exit_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_local_supplier_arrival" DROP CONSTRAINT IF EXISTS "zmcc_local_supplier_arrival_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_mot_arrival" DROP CONSTRAINT IF EXISTS "zmcc_mot_arrival_exit_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_mot_arrival" DROP CONSTRAINT IF EXISTS "zmcc_mot_arrival_last_corrected_by_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank" DROP CONSTRAINT IF EXISTS "zmcc_tank_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank" DROP CONSTRAINT IF EXISTS "zmcc_tank_updated_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank" DROP CONSTRAINT IF EXISTS "zmcc_tank_zmcc_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" DROP CONSTRAINT IF EXISTS "zmcc_tank_inventory_transaction_performed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" DROP CONSTRAINT IF EXISTS "zmcc_tank_inventory_transaction_tank_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" DROP CONSTRAINT IF EXISTS "zmcc_tank_inventory_transaction_tank_receipt_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" DROP CONSTRAINT IF EXISTS "zmcc_tank_inventory_transaction_zmcc_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_receipt" DROP CONSTRAINT IF EXISTS "zmcc_tank_receipt_lab_session_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_receipt" DROP CONSTRAINT IF EXISTS "zmcc_tank_receipt_last_corrected_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_receipt" DROP CONSTRAINT IF EXISTS "zmcc_tank_receipt_received_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_receipt" DROP CONSTRAINT IF EXISTS "zmcc_tank_receipt_tank_id_fkey";

-- DropForeignKey
ALTER TABLE "zmcc_tank_receipt" DROP CONSTRAINT IF EXISTS "zmcc_tank_receipt_zmcc_id_fkey";

-- AlterTable
ALTER TABLE "chiller_ownership" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lab_test_assignment" ALTER COLUMN "assigned_at" SET DATA TYPE TIMESTAMP(6);

-- AlterTable
ALTER TABLE "local_supplier_rmr_legacy_classification" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "milk_test_policy_assignment" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mot_collection_sms_outbox" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mot_journey" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mot_journey_stop" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mot_profile" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mot_vehicle" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_preference" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "push_subscription" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_area" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_contractor_arrival" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_lab_result" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_lab_session" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_milk_source" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_mot_arrival" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_route" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_shop" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_tank" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zmcc_tank_receipt" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "local_supplier_rmr_legacy_classification" RENAME CONSTRAINT "local_supplier_rmr_legacy_classification_arrival_fkey" TO "local_supplier_rmr_legacy_classification_local_supplier_ar_fkey";

-- RenameForeignKey
ALTER TABLE "local_supplier_rmr_legacy_classification" RENAME CONSTRAINT "local_supplier_rmr_legacy_classification_reviewer_fkey" TO "local_supplier_rmr_legacy_classification_reviewed_by_user__fkey";

-- RenameForeignKey
ALTER TABLE "plant_final_dual_reconciliation" RENAME CONSTRAINT "plant_final_dual_reconciliation_final_receipt_transaction_id_fk" TO "plant_final_dual_reconciliation_final_receipt_transaction__fkey";

-- RenameForeignKey
ALTER TABLE "zmcc_lab_session" RENAME CONSTRAINT "zmcc_lab_session_attendant_recommended_by_fkey" TO "zmcc_lab_session_attendant_recommended_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "zmcc_lab_session" RENAME CONSTRAINT "zmcc_lab_session_final_decided_by_fkey" TO "zmcc_lab_session_final_decided_by_user_id_fkey";

-- AddForeignKey
ALTER TABLE "vehicle_visit" ADD CONSTRAINT "vehicle_visit_last_corrected_by_user_id_fkey" FOREIGN KEY ("last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mot_shop_collection" ADD CONSTRAINT "mot_shop_collection_last_corrected_by_user_id_fkey" FOREIGN KEY ("last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_mot_arrival" ADD CONSTRAINT "zmcc_mot_arrival_last_corrected_by_user_id_fkey" FOREIGN KEY ("last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_mot_arrival" ADD CONSTRAINT "zmcc_mot_arrival_exit_last_corrected_by_user_id_fkey" FOREIGN KEY ("exit_last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_local_supplier_arrival" ADD CONSTRAINT "zmcc_local_supplier_arrival_last_corrected_by_user_id_fkey" FOREIGN KEY ("last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_local_supplier_arrival" ADD CONSTRAINT "zmcc_local_supplier_arrival_exit_last_corrected_by_user_id_fkey" FOREIGN KEY ("exit_last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank" ADD CONSTRAINT "zmcc_tank_zmcc_id_fkey" FOREIGN KEY ("zmcc_id") REFERENCES "procurement_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank" ADD CONSTRAINT "zmcc_tank_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank" ADD CONSTRAINT "zmcc_tank_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_receipt" ADD CONSTRAINT "zmcc_tank_receipt_lab_session_id_fkey" FOREIGN KEY ("lab_session_id") REFERENCES "zmcc_lab_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_receipt" ADD CONSTRAINT "zmcc_tank_receipt_zmcc_id_fkey" FOREIGN KEY ("zmcc_id") REFERENCES "procurement_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_receipt" ADD CONSTRAINT "zmcc_tank_receipt_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "zmcc_tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_receipt" ADD CONSTRAINT "zmcc_tank_receipt_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_receipt" ADD CONSTRAINT "zmcc_tank_receipt_last_corrected_by_user_id_fkey" FOREIGN KEY ("last_corrected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" ADD CONSTRAINT "zmcc_tank_inventory_transaction_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "zmcc_tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" ADD CONSTRAINT "zmcc_tank_inventory_transaction_zmcc_id_fkey" FOREIGN KEY ("zmcc_id") REFERENCES "procurement_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" ADD CONSTRAINT "zmcc_tank_inventory_transaction_tank_receipt_id_fkey" FOREIGN KEY ("tank_receipt_id") REFERENCES "zmcc_tank_receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zmcc_tank_inventory_transaction" ADD CONSTRAINT "zmcc_tank_inventory_transaction_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "lab_test_rule_lab_test_id_testing_point_rule_category_version_k" RENAME TO "lab_test_rule_lab_test_id_testing_point_rule_category_versi_key";

-- RenameIndex
ALTER INDEX "local_supplier_rmr_legacy_classification_arrival_key" RENAME TO "local_supplier_rmr_legacy_classification_local_supplier_arr_key";

-- RenameIndex
ALTER INDEX "local_supplier_rmr_legacy_classification_status_idx" RENAME TO "local_supplier_rmr_legacy_classification_classification_cre_idx";

-- RenameIndex
ALTER INDEX "mot_shop_collection_journey_stop_composite_key" RENAME TO "mot_shop_collection_journey_id_journey_stop_id_key";

-- RenameIndex
ALTER INDEX "plant_final_dual_reconciliation_final_receipt_transaction_id_ke" RENAME TO "plant_final_dual_reconciliation_final_receipt_transaction_i_key";

-- RenameIndex
ALTER INDEX "zmcc_lab_session_final_decision_idx" RENAME TO "zmcc_lab_session_final_decision_final_decided_at_idx";

-- RenameIndex
ALTER INDEX "zmcc_tank_inv_tx_tank_id_op_time_idx" RENAME TO "zmcc_tank_inventory_transaction_tank_id_operational_timesta_idx";

-- RenameIndex
ALTER INDEX "zmcc_tank_inv_tx_zmcc_id_op_time_idx" RENAME TO "zmcc_tank_inventory_transaction_zmcc_id_operational_timesta_idx";

