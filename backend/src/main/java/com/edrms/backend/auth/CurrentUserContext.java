package com.edrms.backend.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CurrentUserContext {

    public Optional<String> getCurrentUserKeycloakId() {
        return getJwt().map(Jwt::getSubject);
    }

    public Optional<String> getCurrentUsername() {
        return getJwt().map(jwt -> jwt.getClaimAsString("preferred_username"));
    }

    public Optional<String> getCurrentUserEmail() {
        return getJwt().map(jwt -> jwt.getClaimAsString("email"));
    }

    public Optional<Jwt> getJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return Optional.of(jwt);
        }
        return Optional.empty();
    }
}
