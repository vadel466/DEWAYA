import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/requests", requestsRouter);
router.use("/notifications", notificationsRouter);

export default router;
