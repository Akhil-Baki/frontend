package common

import com.gu.contentapi.client.model.v1.{CapiDateTime, ContentFields, Content => ApiContent}
import implicits.Dates.jodaToJavaInstant
import model.{ContentType, ImageMedia, Trail}
import org.joda.time.DateTime
import com.gu.contentapi.client.utils.CapiModelEnrichment.RichOffsetDateTime

import java.time.{OffsetDateTime, ZoneOffset}

trait TestTrails {

  def testTrail(id: String, customTitle: Option[String] = None, byline: Option[String] = Some("Chadders"), webUrl: String = "",
                trailText: Option[String] = None,
                webPublicationDate: Option[DateTime] = None,
                lastModified: Option[DateTime] = None,
                trailPicture: Option[ImageMedia] = None): Trail = {
    val contentItem = ApiContent(
        id = id,
        sectionId = None,
        sectionName = None,
        webUrl = webUrl,
        apiUrl = "",
        webPublicationDate = Some(jodaToCapiDateTime(webPublicationDate.getOrElse(DateTime.now))),
        elements = None,
        webTitle = customTitle getOrElse "hello …",
        fields = Some(
          ContentFields(liveBloggingNow = Some(true), byline = byline, trailText = trailText,
            lastModified = lastModified.map(l => jodaToCapiDateTime(l))
          )
        )
    )

    model.Content(contentItem).trail.copy(trailPicture = trailPicture)
  }

  private def jodaToCapiDateTime(dateTime: DateTime): CapiDateTime = {
    jodaToJavaInstant(dateTime).atOffset(ZoneOffset.UTC).toCapiDateTime
  }

}
