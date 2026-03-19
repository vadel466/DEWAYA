import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import notificationsRouter from "./notifications";
import pharmaciesRouter from "./pharmacies";
import dutyPharmaciesRouter from "./duty-pharmacies";
import pharmacyPortalRouter from "./pharmacy-portal";
import drugPricesRouter from "./drug-prices";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/requests", requestsRouter);
router.use("/notifications", notificationsRouter);
router.use("/pharmacies", pharmaciesRouter);
router.use("/duty-pharmacies", dutyPharmaciesRouter);
router.use("/pharmacy-portal", pharmacyPortalRouter);
router.use("/drug-prices", drugPricesRouter);

export default router;
