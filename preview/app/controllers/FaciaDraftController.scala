package controllers

import com.gu.contentapi.client.model.v1.ItemResponse
import common.TrailsToShowcase
import contentapi.{ContentApiClient, SectionsLookUp}
import controllers.front.FrontJsonFapiDraft
import model.{ApplicationContext, PressedPage}
import play.api.mvc._
import services.ConfigAgent

import scala.concurrent.Future

class FaciaDraftController(
    val frontJsonFapi: FrontJsonFapiDraft,
    contentApiClient: ContentApiClient,
    sectionsLookUp: SectionsLookUp,
    val controllerComponents: ControllerComponents,
)(implicit val context: ApplicationContext)
    extends FaciaController
    with RendersItemResponse {

  private val indexController = new IndexController(contentApiClient, sectionsLookUp, controllerComponents)

  override def renderItem(path: String)(implicit request: RequestHeader): Future[Result] = {
    log.info(s"Serving Path: $path")

    if (!ConfigAgent.getPathIds.contains(path))
      indexController.renderItem(path)
    else
      renderFrontPressResult(path)
  }

  override def canRender(path: String): Boolean = ConfigAgent.getPathIds.contains(path)

  override def canRender(item: ItemResponse): Boolean = indexController.canRender(item)

  override def renderFrontShowcase(path: String): Action[AnyContent] =
    Action.async { implicit request =>
      frontJsonFapi.get(path, liteRequestType).map {
        case Some(faciaPage: PressedPage) =>
          if (TrailsToShowcase.isShowcaseFront(faciaPage)) {
            val (singleStoryPanels, maybeRundownPanel, problems) = TrailsToShowcase.generatePanelsFrom(faciaPage)
            Ok(views.html.showcase(singleStoryPanels, maybeRundownPanel, problems))
          } else {
            // Not a Showcase front
            NotFound
          }
        case _ =>
          NotFound
      }
    }

}
