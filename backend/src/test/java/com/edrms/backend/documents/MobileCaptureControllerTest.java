package com.edrms.backend.documents;
import com.edrms.backend.folders.*;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import java.util.*;
import java.time.OffsetDateTime;
import java.io.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MobileCaptureControllerTest {
    final MobileCaptureLinkRepository links=mock(MobileCaptureLinkRepository.class);
    final FolderRepository folders=mock(FolderRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final RoleCatalogService access=mock(RoleCatalogService.class);
    final DocumentService documents=mock(DocumentService.class);
    final CaptureQualityService quality=mock(CaptureQualityService.class);
    final MobileCaptureController controller=new MobileCaptureController(links,folders,users,access,documents,quality,mock(com.edrms.backend.folders.FolderNumberingService.class));
    final String token="A".repeat(43);
    MobileCaptureLink link;
    @BeforeEach void setup() {
        link=new MobileCaptureLink(); link.setFolderId(UUID.randomUUID()); link.setOwnerId(UUID.randomUUID());
        link.setStatus("OPEN"); link.setExpiresAt(OffsetDateTime.now().plusMinutes(15));
        when(links.lockByHash(anyString())).thenReturn(Optional.of(link));
    }
    @Test void expiredLinkCannotUpload() {
        link.setExpiresAt(OffsetDateTime.now().minusSeconds(1));
        assertThrows(SecurityException.class, () -> controller.upload(token,List.of()));
        verifyNoInteractions(documents);
    }
    @Test void completedLinkDoesNotCreateDuplicateDocument() throws Exception {
        link.setStatus("COMPLETED"); link.setDocumentId(UUID.randomUUID());
        assertEquals(link.getDocumentId(),controller.upload(token,List.of()).get("documentId"));
        verifyNoInteractions(documents);
    }
    @Test void capturesAreAssembledIntoPdfInOrder() throws Exception {
        when(quality.check(anyString(),any())).thenReturn(new CaptureQualityService.Check(true,List.of(),900,1200,100,30));
        User owner=User.builder().id(link.getOwnerId()).status("ACTIVE").role("CONTRIBUTOR").permissions("VIEW,UPLOAD").build();
        when(users.findById(link.getOwnerId())).thenReturn(Optional.of(owner));
        when(folders.findById(link.getFolderId())).thenReturn(Optional.of(Folder.builder().id(link.getFolderId()).isDeleted(false).build()));
        var output=new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(100,200,BufferedImage.TYPE_INT_RGB),"PNG",output);
        var page=new MockMultipartFile("pages","page.png","image/png",output.toByteArray());
        UUID documentId=UUID.randomUUID();
        when(documents.uploadDocument(any(),eq(link.getFolderId()),eq(owner))).thenAnswer(invocation -> {
            org.springframework.web.multipart.MultipartFile pdf=invocation.getArgument(0);
            try (var parsed=org.apache.pdfbox.pdmodel.PDDocument.load(pdf.getBytes())) { assertEquals(2,parsed.getNumberOfPages()); }
            return Document.builder().id(documentId).build();
        });
        assertEquals(documentId,controller.upload(token,List.of(page,page)).get("documentId"));
        assertEquals("COMPLETED",link.getStatus());
    }
    @Test void uploadRequiresExactFolderAssignment() {
        User owner=User.builder().status("ACTIVE").role("CONTRIBUTOR").permissions("UPLOAD").assignedFolderIds(UUID.randomUUID().toString()).build();
        when(users.findById(link.getOwnerId())).thenReturn(Optional.of(owner));
        assertThrows(SecurityException.class, () -> controller.upload(token,List.of()));
        verifyNoInteractions(documents);
    }
    @Test void rejectedQualityDoesNotSaveOrCompleteLink() throws Exception {
        User owner=User.builder().id(link.getOwnerId()).status("ACTIVE").role("CONTRIBUTOR").permissions("UPLOAD").build();
        when(users.findById(link.getOwnerId())).thenReturn(Optional.of(owner));
        when(folders.findById(link.getFolderId())).thenReturn(Optional.of(Folder.builder().id(link.getFolderId()).isDeleted(false).build()));
        when(quality.check(anyString(),any())).thenReturn(new CaptureQualityService.Check(false,List.of("Photo is blurred. Retake it."),900,1200,100,0));
        var photo=new MockMultipartFile("pages","page.png","image/png",new byte[]{1,2,3});
        var failure=assertThrows(IllegalArgumentException.class, () -> controller.upload(token,List.of(photo)));
        assertTrue(failure.getMessage().contains("Page 1")); assertEquals("OPEN",link.getStatus()); verifyNoInteractions(documents);
    }
}
