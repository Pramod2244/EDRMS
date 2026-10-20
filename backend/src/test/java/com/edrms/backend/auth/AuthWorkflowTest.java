package com.edrms.backend.auth;

import com.edrms.backend.audit.AuditService;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import java.time.OffsetDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Controller workflow tests use synthetic accounts; they do not prove HTTP authorization. */
class AuthWorkflowTest {
    private final UserRepository users = mock(UserRepository.class);
    private final RoleCatalogService roles = mock(RoleCatalogService.class);
    private final JwtTokenService tokens = new JwtTokenService("test-only-random-secret-for-auth-workflow-not-for-production");
    private final AuthController controller = new AuthController(tokens, users, mock(AuditService.class), roles);
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private User account;

    @BeforeEach void setup() {
        account = User.builder().id(UUID.randomUUID()).username("qa-user").fullName("QA User")
            .email("qa@example.invalid").passwordHash("Test-only-password!").role("CONTRIBUTOR")
            .status("ACTIVE").permissions("VIEW,UPLOAD").accessibleMenus("/documents,/search")
            .assignedFolderIds(UUID.randomUUID().toString()).isTemporary(false).build();
        when(users.findByUsernameIgnoreCase("qa-user")).thenReturn(Optional.of(account));
        when(users.save(any())).thenAnswer(call -> {
            User user = call.getArgument(0);
            if (user.getId() == null) user.setId(UUID.randomUUID());
            return user;
        });
    }

    @Test void successfulLoginPreservesExplicitPermissionsAndExactFolderClaims() throws Exception {
        var response = controller.login(new AuthLoginRequest(" qa-user ", "Test-only-password!"), request);
        assertEquals(200, response.getStatusCode().value());
        var body = (AuthResponse) response.getBody();
        assertNotNull(body);
        assertEquals(List.of("VIEW", "UPLOAD"), body.getUser().getPermissions());
        assertEquals(List.of(account.getAssignedFolderIds()), body.getUser().getAssignedFolderIds());
        var claims = tokens.validateToken(body.getToken()).orElseThrow();
        assertEquals(account.getId().toString(), claims.getSubject());
        assertEquals(List.of("VIEW", "UPLOAD"), claims.getStringListClaim("permissions"));
        assertFalse(claims.getStringListClaim("permissions").contains("DELETE"));
    }

    @Test void incorrectPasswordDoesNotIssueToken() {
        assertEquals(401, controller.login(new AuthLoginRequest("qa-user", "wrong"), request).getStatusCode().value());
        verify(users, never()).save(any());
    }

    @Test void unknownUsernameReturnsSameCredentialError() {
        var missing = controller.login(new AuthLoginRequest("missing", "wrong"), request);
        var incorrect = controller.login(new AuthLoginRequest("qa-user", "wrong"), request);
        assertEquals(401, missing.getStatusCode().value());
        assertEquals(incorrect.getBody(), missing.getBody());
    }

    @Test void missingPasswordRejected() {
        assertEquals(400, controller.login(new AuthLoginRequest("qa-user", null), request).getStatusCode().value());
        verifyNoInteractions(users);
    }

    @Test void expiredTemporaryAccountCannotLogin() {
        account.setIsTemporary(true);
        account.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        assertEquals(401, controller.login(new AuthLoginRequest("qa-user", "Test-only-password!"), request).getStatusCode().value());
    }

    @Test void firstTemporaryLoginStartsDeadlineOnce() {
        account.setIsTemporary(true);
        account.setDurationSeconds(120L);
        var before = OffsetDateTime.now();
        assertEquals(200, controller.login(new AuthLoginRequest("qa-user", "Test-only-password!"), request).getStatusCode().value());
        var firstDeadline = account.getExpiresAt();
        assertTrue(firstDeadline.isAfter(before.plusSeconds(119)));
        controller.login(new AuthLoginRequest("qa-user", "Test-only-password!"), request);
        assertEquals(firstDeadline, account.getExpiresAt());
        verify(users, times(1)).save(account);
    }

    @Test void customRoleDefaultsAppliedWhenUserHasNoOverrides() {
        account.setRole("QA_REVIEWER");
        account.setPermissions(null);
        account.setAccessibleMenus(null);
        var role = com.edrms.backend.roles.Role.builder().name("QA_REVIEWER")
            .permissionsCsv("VIEW,DOWNLOAD").menusCsv("/documents").build();
        when(roles.find("QA_REVIEWER")).thenReturn(Optional.of(role));
        var body = (AuthResponse) controller.login(new AuthLoginRequest("qa-user", "Test-only-password!"), request).getBody();
        assertNotNull(body);
        assertEquals(List.of("VIEW", "DOWNLOAD"), body.getUser().getPermissions());
        assertEquals(List.of("/documents"), body.getUser().getAccessibleMenus());
    }

    @Test void duplicateUsernameRejectedWithoutSaving() {
        when(users.existsByUsernameIgnoreCase("qa-user")).thenReturn(true);
        var input = CreateUserRequest.builder().username(" qa-user ").password("Test-only-password!").build();
        assertEquals(409, controller.createUser(input).getStatusCode().value());
        verify(users, never()).save(any());
    }

    @Test void userCreationRejectsBlankCredentials() {
        assertEquals(400, controller.createUser(CreateUserRequest.builder().username(" ").password("x").build()).getStatusCode().value());
        assertEquals(400, controller.createUser(CreateUserRequest.builder().username("qa-new").password(" ").build()).getStatusCode().value());
        verify(users, never()).save(any());
    }

    @Test void creationPreservesSelectedRoleMenusPermissionsAndFolder() {
        var input = CreateUserRequest.builder().username("qa-new").password("Test-only-password!")
            .role("QA_REVIEWER").permissions(List.of("VIEW", "DOWNLOAD"))
            .accessibleMenus(List.of("/documents")).assignedFolderIds(List.of(account.getAssignedFolderIds())).build();
        assertEquals(201, controller.createUser(input).getStatusCode().value());
        var saved = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertEquals("QA_REVIEWER", saved.getValue().getRole());
        assertEquals("VIEW,DOWNLOAD", saved.getValue().getPermissions());
        assertEquals(account.getAssignedFolderIds(), saved.getValue().getAssignedFolderIds());
        assertEquals("/documents", saved.getValue().getAccessibleMenus());
    }

    @Test void rootAccountCannotBeDowngradedByRoleUpdate() {
        account.setUsername("admin");
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(account));
        assertEquals(200, controller.updateUser("admin", CreateUserRequest.builder().role("VIEWER").build()).getStatusCode().value());
        assertEquals("SUPER_ADMIN", account.getRole());
    }

    @Test void currentUserRejectsMissingAndInvalidToken() {
        assertEquals(401, controller.getCurrentUser(null).getStatusCode().value());
        assertEquals(401, controller.getCurrentUser("Bearer invalid-token").getStatusCode().value());
    }
}
