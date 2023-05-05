package services.dotcomrendering

import common.GuLogging
import experiments.{ActiveExperiments, DCRFronts}
import implicits.Requests._
import model.PressedPage
import model.facia.PressedCollection
import model.pressed.{LatestSnap, LinkSnap}
import play.api.mvc.RequestHeader
import views.support.Commercial

object FrontChecks {

  // To check which collections are supported by DCR and update this set please check:
  // https://github.com/guardian/dotcom-rendering/blob/main/dotcom-rendering/src/web/lib/DecideContainer.tsx
  // and https://github.com/guardian/dotcom-rendering/issues/4720
  val SUPPORTED_COLLECTIONS: Set[String] =
    Set(
      /*
    "fixed/thrasher",
      pending https://github.com/guardian/dotcom-rendering/issues/5134
       */

      /*
    "dynamic/package",
      pending https://github.com/guardian/dotcom-rendering/issues/5196 and
       */

      /*
    "fixed/video"
      pending https://github.com/guardian/dotcom-rendering/issues/5149
       */

      "dynamic/slow-mpu",
      "fixed/small/slow-V-mpu",
      "fixed/medium/slow-XII-mpu",
      "dynamic/slow",
      "dynamic/fast",
      "fixed/small/slow-I",
      "fixed/small/slow-III",
      "fixed/small/slow-IV",
      "fixed/small/slow-V-third",
      "fixed/small/fast-VIII",
      "fixed/medium/slow-VI",
      "fixed/medium/slow-VII",
      "fixed/medium/fast-XII",
      "fixed/medium/fast-XI",
      "fixed/large/slow-XIV",
      "nav/list",
      "nav/media-list",
      "news/most-popular",
    )

  val UNSUPPORTED_THRASHERS: Set[String] =
    Set(
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/12/wordiply/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/04/australian-election/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/07/full-story/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/10/saved-for-later/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/12/documentaries-signup-thrasher/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/12/100-best-footballers/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/01/football-weekly-thrasher/thrasher",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/11/20/football-interactive-atom/knockout-full",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/07/pegasus/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/07/lakeside/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/07/support-guardian-thrasher/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/02/pw-uk/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/11/comfort-eating-grace-dent-thrasher-no-logo/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2022/02/weekend-podcast-2022/default",
      // We can support those once we support full width for thrashers: https://github.com/guardian/dotcom-rendering/issues/7678
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/default-fronts-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/david-olusoga-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/cassandra-gooptar-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/gary-younge-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/deneen-l-brown-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/the-enslaved-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/olivette-otele-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/interactives-front--globe",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/michael-taylor-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/lanre-bakare-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/hidden-figures-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/2022/10/tr/johny-pitts-photo-essay-front-default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2021/09/pandora-header/default",
      "https: //content.guardianapis.com/atom/interactive/interactives/thrashers/2023/04/cost-of-crown/default",
    )

  def allCollectionsAreSupported(faciaPage: PressedPage): Boolean = {
    faciaPage.collections.forall(collection => SUPPORTED_COLLECTIONS.contains(collection.collectionType))
  }

  def hasNoWeatherWidget(faciaPage: PressedPage): Boolean = {
    // See: https://github.com/guardian/dotcom-rendering/issues/4602
    !faciaPage.isNetworkFront
  }

  def isNotAdFree()(implicit request: RequestHeader): Boolean = {
    // We don't support the signed in experience
    // See: https://github.com/guardian/dotcom-rendering/issues/5926
    !Commercial.isAdFree(request)
  }

  def hasNoPageSkin(faciaPage: PressedPage)(implicit request: RequestHeader): Boolean = {
    // We don't support page skin ads
    // See: https://github.com/guardian/dotcom-rendering/issues/5490
    !faciaPage.metadata.hasPageSkin(request)
  }

  def hasNoSlideshows(faciaPage: PressedPage): Boolean = {
    // We don't support image slideshows
    // See: https://github.com/guardian/dotcom-rendering/issues/4612
    !faciaPage.collections.exists(collection =>
      collection.curated.exists(card => card.properties.imageSlideshowReplace),
    )
  }

  def hasNoPaidCards(faciaPage: PressedPage): Boolean = {
    // We don't support paid content
    // See: https://github.com/guardian/dotcom-rendering/issues/5945
    // See: https://github.com/guardian/dotcom-rendering/issues/5150

    !faciaPage.collections.exists(_.curated.exists(card => card.isPaidFor))
  }

  def hasNoRegionalAusTargetedContainers(faciaPage: PressedPage): Boolean = {
    // We don't support the Aus region selector component
    // https://github.com/guardian/dotcom-rendering/issues/6234
    !faciaPage.collections.exists(collection =>
      collection.targetedTerritory.exists(_.id match {
        case "AU-VIC" => true
        case "AU-QLD" => true
        case "AU-NSW" => true
        case _        => false
      }),
    )
  }

  def hasNoUnsupportedSnapLinkCards(faciaPage: PressedPage): Boolean = {
    def containsUnsupportedSnapLink(collection: PressedCollection) = {
      collection.curated.exists(card =>
        card match {
          case card: LinkSnap if card.properties.embedType.contains("link") => false
          case card: LinkSnap if card.properties.embedType.contains("interactive") =>
            card.properties.embedUri.exists(UNSUPPORTED_THRASHERS.contains)
          // We don't support json.html embeds yet
          case card: LinkSnap if card.properties.embedType.contains("json.html") => true
          // Because embedType is typed as Option[String] it's hard to know whether we've
          // identified all possible embedTypes. If it's an unidentified embedType then
          // assume we can't render it.
          case _: LinkSnap => true
          case _           => false
        },
      )
    }
    !faciaPage.collections.exists(collection => containsUnsupportedSnapLink(collection))
  }

  //  We should add these to the `SUPPORTED_COLLECTIONS` above when they are supported
  //  This is predominantly for assess how much more coverage each of these containers would give us
  def hasNoThrashers(faciaPage: PressedPage): Boolean = {
    !faciaPage.collections.map(_.collectionType).contains("fixed/thrasher")
  }

  def hasNoDynamicPackage(faciaPage: PressedPage): Boolean = {
    !faciaPage.collections.map(_.collectionType).contains("dynamic/package")
  }

  def hasNoFixedVideo(faciaPage: PressedPage): Boolean = {
    !faciaPage.collections.map(_.collectionType).contains("fixed/video")
  }

}

object FaciaPicker extends GuLogging {

  def dcrChecks(faciaPage: PressedPage)(implicit request: RequestHeader): Map[String, Boolean] = {
    Map(
      ("allCollectionsAreSupported", FrontChecks.allCollectionsAreSupported(faciaPage)),
      ("hasNoWeatherWidget", FrontChecks.hasNoWeatherWidget(faciaPage)),
      ("isNotAdFree", FrontChecks.isNotAdFree()),
      ("hasNoPageSkin", FrontChecks.hasNoPageSkin(faciaPage)),
      ("hasNoSlideshows", FrontChecks.hasNoSlideshows(faciaPage)),
      ("hasNoPaidCards", FrontChecks.hasNoPaidCards(faciaPage)),
      ("hasNoRegionalAusTargetedContainers", FrontChecks.hasNoRegionalAusTargetedContainers(faciaPage)),
      ("hasNoUnsupportedSnapLinkCards", FrontChecks.hasNoUnsupportedSnapLinkCards(faciaPage)),
      ("hasNoThrashers", FrontChecks.hasNoThrashers(faciaPage)),
      ("hasNoDynamicPackage", FrontChecks.hasNoDynamicPackage(faciaPage)),
      ("hasNoFixedVideo", FrontChecks.hasNoFixedVideo(faciaPage)),
    )
  }

  def getTier(faciaPage: PressedPage)(implicit request: RequestHeader): RenderType = {
    lazy val participatingInTest = ActiveExperiments.isParticipating(DCRFronts)
    lazy val checks = dcrChecks(faciaPage)
    lazy val dcrCouldRender = checks.values.forall(checkValue => checkValue)

    val tier = decideTier(request.isRss, request.forceDCROff, request.forceDCR, participatingInTest, dcrCouldRender)

    logTier(faciaPage, participatingInTest, dcrCouldRender, checks, tier)

    tier
  }

  def decideTier(
      isRss: Boolean,
      forceDCROff: Boolean,
      forceDCR: Boolean,
      participatingInTest: Boolean,
      dcrCouldRender: Boolean,
  ): RenderType = {
    if (isRss) LocalRender
    else if (forceDCROff) LocalRender
    else if (forceDCR) RemoteRender
    else if (dcrCouldRender && participatingInTest) RemoteRender
    else LocalRender
  }

  private def logTier(
      faciaPage: PressedPage,
      participatingInTest: Boolean,
      dcrCouldRender: Boolean,
      checks: Map[String, Boolean],
      tier: RenderType,
  )(implicit request: RequestHeader): Unit = {
    val tierReadable = if (tier == RemoteRender) "dotcomcomponents" else "web"
    val checksToString = checks.map {
      case (key, value) =>
        (key, value.toString)
    }
    val properties =
      Map(
        "participatingInTest" -> participatingInTest.toString,
        "testPercentage" -> DCRFronts.participationGroup.percentage,
        "dcrCouldRender" -> dcrCouldRender.toString,
        "isFront" -> "true",
        "tier" -> tierReadable,
      ) ++ checksToString

    DotcomFrontsLogger.logger.logRequest(s"front executing in $tierReadable", properties, faciaPage)
  }
}
