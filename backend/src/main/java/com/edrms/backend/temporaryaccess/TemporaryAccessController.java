package com.edrms.backend.temporaryaccess;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/temporary-access")
public class TemporaryAccessController {

    private final TemporaryAccessService temporaryAccessService;

    public TemporaryAccessController(TemporaryAccessService temporaryAccessService) {
        this.temporaryAccessService = temporaryAccessService;
    }

    @GetMapping("/verify/{token}")
    public ResponseEntity<TemporaryAccessGrant> verifyToken(@PathVariable String token) {
        return temporaryAccessService.validateAndConsume(token)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
