import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import notificationsRouter from "./notifications";
import pharmaciesRouter from "./pharmacies";
import dutyPharmaciesRouter from "./duty-pharmacies";
import dutyImagesRouter from "./duty-images";
import pharmacyPortalRouter from "./pharmacy-portal";
import drugPricesRouter from "./drug-prices";
import doctorsRouter from "./doctors";
import companyPortalRouter from "./company-portal";
import otherServicesRouter from "./other-services";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/requests", requestsRouter);
router.use("/notifications", notificationsRouter);
router.use("/pharmacies", pharmaciesRouter);
router.use("/duty-pharmacies", dutyPharmaciesRouter);
router.use("/duty-images", dutyImagesRouter);
router.use("/pharmacy-portal", pharmacyPortalRouter);
router.use("/drug-prices", drugPricesRouter);
router.use("/doctors", doctorsRouter);
router.use("/company-portal", companyPortalRouter);
router.use("/other-services", otherServicesRouter);

export default router;
