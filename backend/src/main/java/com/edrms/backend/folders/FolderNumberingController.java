package com.edrms.backend.folders;
import com.edrms.backend.roles.RoleCatalogService;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/v1/folders/{id}/numbering")
public class FolderNumberingController {
    private final FolderNumberingService service;
    private final RoleCatalogService access;
    public FolderNumberingController(FolderNumberingService service,RoleCatalogService access) { this.service=service; this.access=access; }
    @GetMapping public FolderNumberingService.View get(@PathVariable UUID id) {
        var user=access.requireUser();
        if(!"SUPER_ADMIN".equals(user.getRole()) && !RoleCatalogService.split(user.getAssignedFolderIds()).isEmpty() && !RoleCatalogService.split(user.getAssignedFolderIds()).contains(id.toString())) throw new SecurityException("Folder access is required");
        return service.get(id);
    }
    @PutMapping public FolderNumberingService.View save(@PathVariable UUID id,@RequestBody FolderNumberingService.Settings value) { access.requireManager(); get(id); return service.save(id,value); }
}
