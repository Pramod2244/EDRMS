package com.edrms.backend.roles;
import com.edrms.backend.auth.CurrentUserContext;
import com.edrms.backend.users.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class RoleCatalogServiceTest {
    final RoleRepository roles=mock(RoleRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final CurrentUserContext context=mock(CurrentUserContext.class);
    final RoleCatalogService service=new RoleCatalogService(roles,users,context);
    @BeforeEach void setup() {
        when(context.getCurrentUsername()).thenReturn(Optional.of("admin"));
        when(users.findByUsername("admin")).thenReturn(Optional.of(User.builder().status("ACTIVE").role("SUPER_ADMIN").build()));
    }
    @Test void protectsBuiltInRoles() {
        UUID id=UUID.randomUUID(); when(roles.findById(id)).thenReturn(Optional.of(Role.builder().id(id).name("VIEWER").isSystem(true).build()));
        assertThrows(SecurityException.class, () -> service.save(id,new RoleCatalogService.Request("VIEWER","",List.of("DELETE"),List.of("/documents"))));
        verify(roles,never()).save(any());
    }
    @Test void rejectsUnknownPermissions() {
        assertThrows(IllegalArgumentException.class, () -> service.save(null,new RoleCatalogService.Request("ACCOUNTS","",List.of("EXECUTE"),List.of("/documents"))));
    }
    @Test void createsCustomRoleWithoutChangingUsers() {
        when(roles.findByName("ACCOUNTS")).thenReturn(Optional.empty());
        when(roles.save(any())).thenAnswer(invocation -> { Role role=invocation.getArgument(0); role.setId(UUID.randomUUID()); return role; });
        var result=service.save(null,new RoleCatalogService.Request("ACCOUNTS","Accounts team",List.of("VIEW","UPLOAD"),List.of("/documents")));
        assertEquals(false,result.get("system")); assertEquals(List.of("VIEW","UPLOAD"),result.get("permissions"));
        verify(users,never()).save(any());
    }
    @Test void disallowsUnprivilegedManagement() {
        when(users.findByUsername("admin")).thenReturn(Optional.of(User.builder().status("ACTIVE").role("VIEWER").permissions("VIEW").build()));
        assertThrows(SecurityException.class,service::list); verifyNoInteractions(roles);
    }
}
